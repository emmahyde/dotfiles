import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "bin/groot-wt-gc"


class WorktreeCleanupTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.origin = self.root / "origin.git"
        self.repo = self.root / "main"
        self.trees = self.root / "worktrees"
        self.trees.mkdir()
        self.command("git", "init", "--bare", "--initial-branch=main", str(self.origin))
        self.command("git", "clone", str(self.origin), str(self.repo))
        self.git(self.repo, "config", "user.email", "cleanup-test@example.invalid")
        self.git(self.repo, "config", "user.name", "Cleanup Test")
        (self.repo / "source").write_text("preserve source\n")
        (self.repo / ".gitignore").write_text("target/\nnode_modules/\n.env\n")
        self.git(self.repo, "add", ".")
        self.git(self.repo, "commit", "-m", "test: initial source")
        self.git(self.repo, "push", "origin", "main")

    def command(self, *args):
        result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def git(self, path, *args):
        return self.command("git", "-C", str(path), *args)

    def tree(self, name="safe tree"):
        path = self.trees / name
        self.git(self.repo, "worktree", "add", "-b", name.replace(" ", "-"), str(path), "main")
        return path

    def cleanup_report(self, *args, expected=0):
        result = subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.trees),
                                 "--days", "0", "--no-caches", "--json", *args],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.assertEqual(result.returncode, expected, result.stderr + result.stdout)
        return json.loads(result.stdout)

    def row(self, report, path):
        return next(row for row in report["items"] if row["path"] == str(path))

    def test_preview_then_remove_merged_tree_without_deleting_branch(self):
        tree = self.tree()
        (tree / "target").mkdir()
        (tree / "target/build").write_bytes(b"rebuild me")
        preview = self.cleanup_report()
        self.assertEqual(self.row(preview, tree)["action"], "WOULD REMOVE")
        self.assertTrue((tree / "source").exists())
        applied = self.cleanup_report("--apply")
        self.assertEqual(self.row(applied, tree)["action"], "REMOVE")
        self.assertFalse(tree.exists())
        self.git(self.repo, "show-ref", "--verify", "refs/heads/safe-tree")
        self.assertEqual((self.repo / "source").read_text(), "preserve source\n")

    def test_explicit_branch_deletion_only_after_safe_removal(self):
        tree = self.tree("merged")
        report = self.cleanup_report("--apply", "--delete-branches")
        self.assertEqual(self.row(report, tree)["action"], "REMOVE")
        self.assertNotIn("refs/heads/merged", self.git(self.repo, "show-ref"))

    def test_preserves_dirty_untracked_and_ignored_secret(self):
        dirty = self.tree("dirty")
        (dirty / "source").write_text("uncommitted work\n")
        untracked = self.tree("untracked")
        (untracked / "new file").write_text("unique work\n")
        secret = self.tree("secret")
        (secret / ".env").write_text("LOCAL_SETTING=preserve\n")
        report = self.cleanup_report("--apply")
        for tree in (dirty, untracked, secret):
            self.assertEqual(self.row(report, tree)["action"], "KEEP")
            self.assertTrue(tree.exists())
        self.assertIn("protected ignored", self.row(report, secret)["reason"])
        self.assertEqual((dirty / "source").read_text(), "uncommitted work\n")
        self.assertEqual((untracked / "new file").read_text(), "unique work\n")
        self.assertEqual((secret / ".env").read_text(), "LOCAL_SETTING=preserve\n")

    def test_preserves_unmerged_commit(self):
        tree = self.tree("unmerged")
        (tree / "source").write_text("unique committed work\n")
        self.git(tree, "commit", "-am", "test: unique work")
        report = self.cleanup_report("--apply", "--delete-branches")
        self.assertIn("HEAD not contained", self.row(report, tree)["reason"])
        self.assertEqual((tree / "source").read_text(), "unique committed work\n")

    def test_preserves_recent_and_locked_worktrees(self):
        recent = self.tree("recent")
        report = self.cleanup_report("--apply", "--days", "7")
        self.assertEqual(self.row(report, recent)["action"], "KEEP")
        self.assertTrue(recent.exists())
        self.git(self.repo, "worktree", "lock", str(recent))
        report = self.cleanup_report("--apply")
        self.assertIn("locked", self.row(report, recent)["reason"])
        self.assertTrue(recent.exists())

    def test_preserves_stashed_work(self):
        tree = self.tree()
        (tree / "source").write_text("stashed work\n")
        self.git(tree, "stash", "push", "-m", "preserve")
        report = self.cleanup_report("--apply")
        self.assertEqual(self.row(report, tree)["reason"], "repository has stashed work")
        self.assertIn("stashed work", self.git(tree, "stash", "show", "-p"))

    def test_failed_remote_check_preserves_tree(self):
        tree = self.tree()
        self.git(self.repo, "remote", "set-url", "origin", str(self.root / "missing.git"))
        report = self.cleanup_report("--apply", expected=1)
        self.assertTrue(tree.exists())
        self.assertTrue(any("failed" in row["reason"] for row in report["items"]))

    def test_active_process_protects_worktree(self):
        tree = self.tree()
        child = subprocess.Popen([sys.executable, "-c", "import time; print('ready', flush=True); time.sleep(60)"],
                                 cwd=tree, stdout=subprocess.PIPE, text=True)
        try:
            self.assertEqual(child.stdout.readline().strip(), "ready")
            report = self.cleanup_report("--apply")
            self.assertEqual(self.row(report, tree)["reason"], "files open or process active in worktree")
            self.assertTrue(tree.exists())
        finally:
            child.terminate()
            child.wait()
            child.stdout.close()

    def test_multiple_worktrees_use_permanent_repository(self):
        first = self.tree("first")
        second = self.tree("second")
        report = self.cleanup_report("--apply")
        for tree in (first, second):
            self.assertEqual(self.row(report, tree)["action"], "REMOVE")
            self.assertFalse(tree.exists())
        self.assertEqual((self.repo / "source").read_text(), "preserve source\n")

    def test_build_cleanup_preserves_uncommitted_source(self):
        tree = self.tree()
        (tree / "Cargo.toml").write_text("[package]\nname = 'example'\n")
        (tree / "source").write_text("unique uncommitted work\n")
        (tree / "target").mkdir()
        (tree / "target/build").write_bytes(b"regenerate")
        report = self.cleanup_report("--no-worktrees", "--builds", "--apply")
        self.assertEqual(self.row(report, tree / "target")["action"], "REMOVE")
        self.assertFalse((tree / "target").exists())
        self.assertEqual((tree / "source").read_text(), "unique uncommitted work\n")
        self.assertTrue((tree / "Cargo.toml").exists())

    def test_build_cleanup_preserves_tracked_output_paths(self):
        for directory, manifest in (("target", "Cargo.toml"), ("node_modules", "package.json")):
            with self.subTest(directory=directory):
                tree = self.tree(f"tracked-{directory}")
                (tree / manifest).write_text("{}\n")
                output = tree / directory
                output.mkdir()
                (output / "source").write_text("tracked source, not a cache\n")
                self.git(tree, "add", "-f", f"{directory}/source")
                self.git(tree, "commit", "-m", "test: preserve tracked output path")
                report = self.cleanup_report("--no-worktrees", "--builds", "--apply")
                self.assertEqual(self.row(report, output)["action"], "KEEP")
                self.assertEqual((output / "source").read_text(), "tracked source, not a cache\n")

    def test_build_cleanup_preserves_nested_repository(self):
        tree = self.tree()
        (tree / "Cargo.toml").write_text("[package]\nname = 'example'\n")
        nested = tree / "target/nested"
        nested.mkdir(parents=True)
        self.git(nested, "init")
        (nested / "source").write_text("unique nested work\n")
        report = self.cleanup_report("--no-worktrees", "--builds", "--apply")
        self.assertEqual(self.row(report, tree / "target")["action"], "KEEP")
        self.assertEqual((nested / "source").read_text(), "unique nested work\n")
        worktree_report = self.cleanup_report("--apply")
        self.assertEqual(self.row(worktree_report, tree)["action"], "KEEP")
        self.assertEqual((nested / "source").read_text(), "unique nested work\n")

    def test_cache_preview_apply_and_symlink_preservation(self):
        cache = self.root / "cache"
        cache.mkdir()
        (cache / "download").write_text("regenerate\n")
        outside = self.root / "unique"
        outside.mkdir()
        (outside / "source").write_text("keep\n")
        link = self.root / "cache-link"
        link.symlink_to(outside, target_is_directory=True)
        result = subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.trees),
                                 "--no-worktrees", "--cache-root", str(cache), "--cache-root", str(link), "--json"],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.row(json.loads(result.stdout), cache)["action"], "WOULD REMOVE")
        self.assertTrue(cache.exists())
        result = subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.trees), "--no-worktrees",
                                 "--cache-root", str(cache), "--cache-root", str(link), "--apply", "--json"],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(cache.exists())
        self.assertEqual((outside / "source").read_text(), "keep\n")
        self.assertTrue(link.is_symlink())


if __name__ == "__main__":
    unittest.main()
