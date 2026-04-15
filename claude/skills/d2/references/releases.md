# D2 - Releases

**Pages:** 24

---

## 

**URL:** https://d2lang.com/releases/0.4.0/

**Contents:**
- 0.4.0
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​
    - Breaking changes​

Major updates in 0.4.0:

To showcase both of these, here's a demo with a link to the source code below:

Bunch of other features, improvements, and bug fixes too. Make sure to check out the updated docs for how to use these new features!

---

## Powerpoint example​

**URL:** https://d2lang.com/releases/0.4.1/

**Contents:**
- 0.4.1
- Powerpoint example​
- GIF example​
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

Multi-board D2 compositions now get 2 more useful formats to export to: PowerPoint and GIFs.

Make sure you click present, and click around the links and navigations!

This is the same diagram as one we shared when we announced animated SVGs, but in GIF form.

---

## 

**URL:** https://d2lang.com/releases/0.2.5/

**Contents:**
- 0.2.5
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

Customizations and layouts take a big leap forward with this release! Put together, these improvements make beautiful diagrams like these possible:

---

## 

**URL:** https://d2lang.com/releases/0.2.4/

**Contents:**
- 0.2.4
    - Improvements 🧹​
    - Bugfixes ⛑️​

ELK layout has been much improved by increasing node dimensions to make room for nice even padding around ports:

Do you use ELK more than dagre? We're considering switching d2's default layout engine to ELK, so please chime in to this poll if you have an opinion! https://github.com/terrastruct/d2/discussions/990

---

## 

**URL:** https://d2lang.com/releases/0.2.3/

**Contents:**
- 0.2.3
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

Diagrams that link between objects and the source they represent are much more integrated into your overall documentation than standalone diagrams. This release brings the linking feature to PDFs! Try clicking on "GitHub" object in the following PDF:

Code blocks now adapt to dark mode:

Welcome new contributor @donglixiaoche , who helps D2 support border-radius on connections!

---

## 

**URL:** https://d2lang.com/releases/0.5.1/

**Contents:**
- 0.5.1
    - Improvements 🧹​

This is a hotfix to 0.5.0, imports weren't working on Windows.

---

## 

**URL:** https://d2lang.com/releases/0.1.0/

**Contents:**
- 0.1.0
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

When we launched D2 to open-source 2 weeks ago, we left the sprint after it a completely blank slate. Because, while we do have long-term goals, we wanted to make the first post-launch update focused 100% on addressing the biggest pain points that came up. Thank you so much to everyone who asked for or complained about something. Every item in this release was something that was posted on the D2 Discord, a GitHub issue/discussion, a comment on social media, or an email.

On top of the listed changes to core D2, we have been building out integrations, starting with Obsidian. Work has also begun on the API and Playground.

If you want a fast way to check out what a change looks like, we put screenshots in the PRs when it's a visual change.

---

## 

**URL:** https://d2lang.com/releases/0.6.0/

**Contents:**
- 0.6.0
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

D2 v0.6 introduces variable substitutions and globs. These two were the last of the features planned in the initial designs for D2, and v1 is now very close!

The power of variables and globs in a programming language need no introduction, so here's two minimal examples to get started:

Both are live on D2 Playground so give it a try! Looking forward to your issues and iterating

Layout capability also takes a subtle but important step forward: you can now customize the position of labels and icons.

---

## 

**URL:** https://d2lang.com/releases/0.1.2/

**Contents:**
- 0.1.2
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

D2 now has an official playground site: https://play.d2lang.com. It loads and runs fast, works on all the major browsers and has been tested on desktop and mobile on a variety of devices. It's the easiest way to get started with D2 and share diagrams. The playground is all open source (https://github.com/terrastruct/d2-playground). We'd love to hear your feedback and feature requests.

Windows users, the install experience just got a whole lot better. Making D2 accessible and easy to use continues to be a priority for us. With this release, we added an MSI installer for Windows, so that installs are just a few clicks. An official Docker image has also been added.

---

## 

**URL:** https://d2lang.com/releases/0.6.1/

**Contents:**
- 0.6.1
  - Before​
  - Now​
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

The globs feature underwent a major rewrite and is now almost finalized.

Previously, globs would evaluate once on all the shapes and connections declared above it. So if you wanted to set everything red, you had to add the line at the bottom.

We still have one more release in 0.6 series to add filters to globs, so stay tuned.

You might also be interested to know that grid cells can now have connections between them! Source code for this diagram here.

---

## 

**URL:** https://d2lang.com/releases/intro/

**Contents:**
- Overview

Version: 0.7.1 (released August 19, 2025)Downloads: Assets

These release notes are the same one as the ones on GitHub releases. They are copied here for convenience and posterity.

D2 launched to open-source on version 0.0.12, so the changelogs start 0.0.13 and on.

---

## 

**URL:** https://d2lang.com/releases/0.2.1/

**Contents:**
- 0.2.1
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

Dark mode support has landed! Thanks to https://github.com/vfosnar for such a substaintial first-time contribution to D2. Only one dark theme option accompanies the support, so if you have a dark theme you like, please feel free to submit into D2!

https://user-images.githubusercontent.com/3120367/221057628-e474b040-4ecb-4177-bb81-a04c95a4648f.mp4

D2 is now usable in non-Latin languages (and emojis!), as the font-measuring accounts for multi-byte characters. Thanks https://github.com/bo-ku-ra for keeping this top of mind.

Sketch mode's subtle hand-drawn texture adapts to background colors. Previously the streaks were too subtle on lighter backgrounds and too prominent on darker ones.

This release also fixes a number of non-trivial layout bugs made in v0.2.0, and has better error messages.

---

## 

**URL:** https://d2lang.com/releases/0.2.0/

**Contents:**
- 0.2.0
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​
    - Breaking changes​

Here's what a D2 diagram looks like in 0.1 (left) vs 0.2 (right):

Much more legible, especially in larger diagrams! This upgrade trims a lot of the excess whitespace present before and makes diagrams more compact. We've also combed through each shape to improve their label and icon positions, paddings, and aspect ratios at different sizes. Example of icons and labels avoiding collisions:

We've also put up a hosted icon site for you to conveniently find common software architecture icons to include in your D2 diagrams. https://icons.terrastruct.com

There's also been a major compiler rewrite. It's fixed many minor compiler bugs, but most importantly, it implements multi-board diagrams. Stay tuned for more as we write docs and make this accessible in the next release!

---

## 

**URL:** https://d2lang.com/releases/0.6.5/

**Contents:**
- 0.6.5
    - Bugfixes ⛑️​

D2 0.6.5 has a hotfix for 0.6.4 breaking plugin compatibility. Also includes 2 compiler fixes regarding substitutions/vars.

---

## 

**URL:** https://d2lang.com/releases/0.4.2/

**Contents:**
- 0.4.2
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

This release improves on the features introduced in 0.4, with class keyword now accepting multiple class values with an array, and grid diagrams becoming faster and more robust.

Multiple classes example:

---

## 

**URL:** https://d2lang.com/releases/0.7.1/

**Contents:**
- 0.7.1
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​
    - Breaking Changes​

For the latest d2.js changes, see separate changelog.

---

## 

**URL:** https://d2lang.com/releases/0.7.0/

**Contents:**
- 0.7.0
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

For the latest d2.js changes, see separate changelog.

---

## 

**URL:** https://d2lang.com/releases/0.6.2/

**Contents:**
- 0.6.2
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

D2 0.6.2 makes grid diagrams significantly more powerful. Namely, connections can now be made from grid elements to other grid elements. This enables diagrams like the following.

Credit: this diagram is based off of a manually-drawn one from a blog post

In addition, another significant feature is that using the ELK layout engine will now route SQL diagrams to their exact columns.

Note that all previous playground links will be broken given the encoding change. The encoding before 0.6.2 used the keyword set as compression dictionary, but it no longer does, so this will be the last time playground links break.

---

## 

**URL:** https://d2lang.com/releases/0.1.6/

**Contents:**
- 0.1.6
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

Many meaningful quality of life improvements and bug fixes, along with a few small features. Overall, a stabilizing set of changes, while some huge features are brewing in the background for the next release!

Thank you to the new contributors that have been joining us. If you want to get involved, there's lots of issues tagged with "good first issue" that are relatively easy to pick up. We're always around to lend a hand, and feel free to drop by our Discord if you're not sure where to start.

Have you enjoyed using D2? We're redesigning some of the site and will have a section for testimonials. If you'd like to be included with a few words alongside your name or public profile, please email us at hi@d2lang.com (or just post it somewhere and let us know)!

---

## 

**URL:** https://d2lang.com/releases/0.6.3/

**Contents:**
- 0.6.3
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

D2 0.6.3 allows you to make your own and customize existing D2 themes. Here's an example with some random color codes.

---

## 

**URL:** https://d2lang.com/releases/0.5.0/

**Contents:**
- 0.5.0
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​
    - Breaking changes​

There are three important features that were in the initial design of D2 that have not been done and hold it back from 1.0: globs, imports, and vars. This release brings imports.

Imports open up a world of possibilities and works beautifully to modularize diagrams. See the new docs to try it out today.

As usual, many improvements and bug fixes accompany this release. D2 0.5 produces more legible diagrams by masking obstructions (e.g. arrow going through a label), has better error messages to guide you, is faster at certain tasks, and addresses many issues brought by community bug reports.

---

## 

**URL:** https://d2lang.com/releases/0.2.2/

**Contents:**
- 0.2.2
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

style keywords now apply at the root level, letting you style the diagram background and frame like so:

(also showcases a little 3d hexagon, newly supported thanks to our newest contributor @JettChenT !)

PDF is also now supported as an export format:

---

## 

**URL:** https://d2lang.com/releases/0.1.4/

**Contents:**
- 0.1.4
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​
    - Breaking changes​

This release introduces interactive diagrams. Namely, tooltip and link can now be set, which allows you to hover to see more or click to go to an external link. This small change enables many possibilities, including richer integrations like internal wiki's that can be linked together through diagrams. An icon will indicate that a shape has a tooltip that can be hovered over for more information, or a link. We have much more in store for interactivity, stay tuned!

Since interactive features obviously won't work on static export formats like PNG, they will be included automatically in an appendix when exporting to those formats, like so:

This release also gives more power to configure layouts. width and height are D2 keywords which previously only worked on images, but now work on any non-containers. Additionally, all the layout engines have configurations exposed. D2 sets sensible defaults to each layout engine without any input, so this is meant to be an advanced feature for users who want that extra control.

---

## 

**URL:** https://d2lang.com/releases/0.1.3/

**Contents:**
- 0.1.3
    - Features 🚀​
    - Improvements 🧹​
    - Bugfixes ⛑️​

Many have asked how to get the diagram to look like the one on D2's cheat sheet. With this release, now you can! See https://d2lang.com/tour/themes/ for more.

The Slack app for D2 has now hit production, so if you're looking for the quickest way to express a visual model without interrupting the conversation flow, go to https://d2lang.com/tour/slack/ to install.

Hope everyone is enjoying the holidays this week!

---
