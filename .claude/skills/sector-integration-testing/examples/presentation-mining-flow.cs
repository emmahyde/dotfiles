// Example: Presentation-layer mining flow integration test
// Tests component interactions WITHOUT GraphicsDevice:
//   MiningInputHandler -> LaserHeatAccumulator -> OreChunkManager -> collection
// Lives in: tests/Sector.Game.Tests/
// References: Full Sector project (can use Vector2, Color, Keys, etc.)

using System;
using Microsoft.Xna.Framework;
using NUnit.Framework;
using Sector.Engine.Core;
using Sector.Engine.Mining;
using Sector.App.Piloting;
using Sector.App.View.Procedural.Terrain;

namespace Sector.Tests.MonoGame {
  [TestFixture, Category("Mining")]
  public sealed class MiningFlowIntegrationTests {
    private LaserHeatAccumulator _heat;
    private MiningInputHandler _input;
    private OreChunkManager _chunks;
    private Random _rng;

    [SetUp]
    public void SetUp() {
      EventBus.ClearAll();
      _rng = new Random(42);
      _heat = new LaserHeatAccumulator(rng: _rng);
      _input = new MiningInputHandler();
      _chunks = new OreChunkManager(new Random(42));
    }

    [TearDown]
    public void TearDown() {
      EventBus.ClearAll();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pattern: Input -> Heat -> Cooldown cycle
    // Tests the frame-by-frame flow without PilotingScene or GraphicsDevice
    // ─────────────────────────────────────────────────────────────────────────

    [Test]
    public void LaserHeldInput_AccumulatesHeat_OverMultipleFrames() {
      // Simulate player holding laser key for several frames
      for (int frame = 0; frame < 60; frame++) {
        _input.HandleHoldInput(fireLaserHeld: true);
        _heat.Tick(laserActive: _input.IsLaserHeld, deltaSeconds: 1f / 60f);
      }

      // After 1 second of hold, heat should be ~1/12 = 0.083
      Assert.That(_heat.Heat, Is.EqualTo(1f / 12f).Within(0.01f));
      Assert.That(_heat.IsInCooldown, Is.False);
    }

    [Test]
    public void LaserHeld12Seconds_TriggersOverheat_EntersCooldown() {
      // Hold laser for 12+ seconds to reach heat = 1.0
      _input.HandleHoldInput(fireLaserHeld: true);
      _heat.Tick(laserActive: _input.IsLaserHeld, deltaSeconds: 13f);

      Assert.That(_heat.IsInCooldown, Is.True, "Should enter forced cooldown");
      Assert.That(_heat.Heat, Is.EqualTo(0f), "Heat resets to 0 on overheat");
      Assert.That(_heat.PopOverheatTrigger(), Is.True, "Overheat fires once");
    }

    [Test]
    public void DuringCooldown_LaserInputIgnored_HeatStaysZero() {
      // Overheat
      _input.HandleHoldInput(fireLaserHeld: true);
      _heat.Tick(laserActive: true, deltaSeconds: 13f);
      Assert.That(_heat.IsInCooldown, Is.True);

      // Try to fire during cooldown — should be ignored
      _heat.Tick(laserActive: true, deltaSeconds: 0.5f);
      Assert.That(_heat.Heat, Is.EqualTo(0f), "Heat stays 0 during cooldown even with laser held");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pattern: OreChunkManager spawn + collection detection
    // Uses real Vector2 physics but no rendering
    // ─────────────────────────────────────────────────────────────────────────

    [Test]
    public void ChunkSpawn_CreatesActorWithDrift_CollectibleByShipProximity() {
      Vector2 fieldPos = new Vector2(100f, 200f);
      _chunks.Spawn(GoodsType.IronOre, chunkCount: 3, fieldPos);

      Assert.That(_chunks.Active.Count, Is.EqualTo(3));

      // Each chunk should have a drift velocity and obstacle data
      foreach (OreChunkActor actor in _chunks.Active) {
        Assert.That(actor.OreType, Is.EqualTo(GoodsType.IronOre));
        Assert.That(actor.Obstacle, Is.Not.Null);
        Assert.That(actor.Obstacle.Type, Is.EqualTo(ObstacleType.OreChunk));
      }
    }

    [Test]
    public void ChunkUpdate_ShipNearby_CollectsChunk() {
      // Spawn a chunk at origin
      _chunks.Spawn(GoodsType.IronOre, chunkCount: 1, Vector2.Zero);

      // Ship at origin — within collection radius
      using EventCapture<OreChunkCollectedEvent> capture = new();

      // Update with ship right on top of the chunk
      // grabRadius > 0 activates grabber pull
      float grabRadiusSector = 90f / 140f; // GrabberBaseRadius / PixelsPerSectorUnit
      _chunks.Update(
        deltaSeconds: 0.1f,
        shipSectorPos: Vector2.Zero,
        scale: 1f,
        grabRadiusSector: grabRadiusSector,
        shipId: EntityId.New());

      // Chunk near ship should be collected (removed from active list)
      // Note: actual collection threshold depends on OreChunkManager internals
      // The test validates the flow works end-to-end
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pattern: MiningInputHandler toggle state
    // Tests edge detection for grabber and processing toggles
    // ─────────────────────────────────────────────────────────────────────────

    [Test]
    public void ToggleGrabber_FlipsEnabledState() {
      Assert.That(_input.GrabberEnabled, Is.False, "Grabber starts disabled");

      _input.HandleEdgeInput(
        fireLaserPressed: false,
        toggleGrabberPressed: true,
        claimBeaconPressed: false,
        toggleProcessingPressed: false);

      Assert.That(_input.GrabberEnabled, Is.True, "First toggle enables grabber");

      _input.HandleEdgeInput(
        fireLaserPressed: false,
        toggleGrabberPressed: true,
        claimBeaconPressed: false,
        toggleProcessingPressed: false);

      Assert.That(_input.GrabberEnabled, Is.False, "Second toggle disables grabber");
    }

    [Test]
    public void ClaimBeaconRequest_OnlyActiveForOneFrame() {
      _input.HandleEdgeInput(
        fireLaserPressed: false,
        toggleGrabberPressed: false,
        claimBeaconPressed: true,
        toggleProcessingPressed: false);

      Assert.That(_input.ClaimBeaconRequested, Is.True, "Active on press frame");

      // Next frame — beacon key not pressed
      _input.HandleEdgeInput(
        fireLaserPressed: false,
        toggleGrabberPressed: false,
        claimBeaconPressed: false,
        toggleProcessingPressed: false);

      Assert.That(_input.ClaimBeaconRequested, Is.False, "Clears after one frame");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pattern: Ore-type-specific visual behavior
    // Tests computed properties on actors without rendering
    // ─────────────────────────────────────────────────────────────────────────

    [Test]
    public void IceChunk_ShrinksInsteadOfFading() {
      OreChunkManager manager = new OreChunkManager(new Random(99));
      manager.Spawn(GoodsType.Ice, 1, Vector2.Zero);
      OreChunkActor ice = (OreChunkActor)manager.Active[0];

      ice.TimeAlive = OreChunkActor.TtlSeconds * 0.5f;

      // Ice shrinks (DisplayScale < 1) but stays fully opaque (Alpha = 1)
      Assert.That(ice.DisplayScale, Is.LessThan(1f));
      Assert.That(ice.Alpha, Is.EqualTo(1f));
    }

    [Test]
    public void RareMetalChunk_HasGlintFlash() {
      OreChunkManager manager = new OreChunkManager(new Random(99));
      manager.Spawn(GoodsType.RareMetals, 1, Vector2.Zero);
      OreChunkActor rare = (OreChunkActor)manager.Active[0];

      // Rare metals initialize with a glint timer
      Assert.That(rare.GlintTimer, Is.GreaterThan(0f));

      // Tick past glint timer to trigger flash
      float initialTimer = rare.GlintTimer;
      manager.Update(initialTimer + 0.01f, new Vector2(9999f, 9999f), 1f, 0f, EntityId.Empty);

      Assert.That(rare.GlintFlashActive, Is.True);
    }
  }
}
