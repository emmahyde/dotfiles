# D2 - Tour

**Pages:** 62

---

## Using the CLI watch mode​

**URL:** https://d2lang.com/tour/intro/

**Contents:**
- D2 Tour
- Using the CLI watch mode​

D2 is a diagram scripting language that turns text to diagrams. It stands for Declarative Diagramming. Declarative, as in, you describe what you want diagrammed, it generates the image.

For example, download the CLI, create a file named input.d2, copy paste the following, run this command, and you get the image below.

You can finish this tour in about 5-10 minutes, and at the end, there's a cheat sheet you can download and refer to. If you want just the bare essentials, Getting Started takes ~2 mins.

The source code for D2 is hosted here: https://github.com/terrastruct/d2.The source code for these docs are here: https://github.com/terrastruct/d2-docs.

The source code for these docs are here: https://github.com/terrastruct/d2-docs.

For each D2 snippet, you can hover over it to open directly in the Playground and tinker.There's some exceptions like snippets that use imports.

There's some exceptions like snippets that use imports.

---

## 

**URL:** https://d2lang.com/tour/scenarios/

**Contents:**
- Scenarios

A "Scenario" represents a different view of the base Layer.

Each Scenario inherits from its base Layer. Any new objects are added onto all objects in the base Layer, and you can reference any objects from the base Layer to update them.

Notice that in the below Scenario, we simply turn some objects opacity lower, and define a new connection to show an alternate view of the deployment diagram.

---

## 

**URL:** https://d2lang.com/tour/hello-world/

**Contents:**
- Hello World

This declares a connection between two shapes, x and y, with the label, hello world.

---

## Null​

**URL:** https://d2lang.com/tour/overrides/

**Contents:**
- Overrides
- Null​
  - Nulling a connection​
  - Nulling an attribute​
  - Implicit nulls​

If you redeclare a shape, the new declaration is merged with the previous declaration.

The latest explicit setting of the label takes priority.

Here's a more complex example of overrides involving containers:

You may override with the value null to delete the shape/connection/attribute.

If you null a shape with connections, its connections are also nulled (since every connection in D2 needs an endpoint).

If you null a shape with descendents, those descendants are also nulled.

---

## 

**URL:** https://d2lang.com/tour/obsidian/

**Contents:**
- Obsidian plugin

D2 has an official plugin for Obsidian.

Currently it only supports rendering of D2 diagrams.

Your browser does not support the video tag.

Github: https://github.com/terrastruct/d2-obsidian

---

## Two types of imports​

**URL:** https://d2lang.com/tour/imports/

**Contents:**
- Syntax
- Two types of imports​
  - 1. Regular import​
  - 2. Spread import​
- Omit the extension​
- Partial imports​
  - Render of donut-flowchart.d2​
- Relative imports​
- Absolute imports​

There are two ways to import. These two examples both have the same result:

Result of running both types of imports below

In the next section, we'll see examples of common import use cases.

This is the equivalent of giving the entire file of x as a map that a sets as its value.

This tells D2 to take the contents of the file x and insert it into the map.

Spread imports only work within maps. Something like a: ...@x.d2 is an invalid usage.

Above, we wrote the full file name for clarity, but the correct usage is to just specify the file name without the suffix. If you run D2's autoformatter, it'll change

D2 will not open files that don't have .d2 extension, which means an import like @x.txt won't work.

You don't have to import the full file.

For example, if you have a file that defines all the people in your organization, and you just want to show some relations between managers, you can import a specific object.

Since . is used for targeting, if you want to import from a file with . in its name, use string quotes.@"schema-v0.1.2"

Relative imports are relative to the file, not the executing path.

Consider that your working directory is /Users/You/dev. Your D2 files:

The above import will search directory /Users/you/dev/ for y.d2, not /Users/You.

Unnecessary relative imports are removed by autoformat.@./x will be autoformatted to @x.

@./x will be autoformatted to @x.

You can also use absolute paths for imports.

---

## SVG​

**URL:** https://d2lang.com/tour/exports/

**Contents:**
- Exports
- SVG​
- PNG​
- PDF​
- PPTX​
- GIF​
- ASCII​
  - Character sets​
    - Extended mode (default)​
    - Standard mode​

On the CLI, you may export .d2 into

SVG is the default export format on the CLI. If you don't specify an output, the export file will be the input name as an SVG file.

For example, d2 in.d2 will produce a file named in.svg.

The resulting SVG has CSS injected into it. This, along with the use of HTML <foreignObject>s used to make Markdown work, means that the SVG is meant to be viewed in a web context. For example, opening it up in your browser, embedding it onto a webpage. It may not look right without a web context, like in Inkscape or Adobe Illustrator.

On the CLI, if you pass in -

planning on doing post-processing on the SVG exports.Element IDs: All shape elements get CSS classes with base64-encoded IDs for safe CSS targeting. For example, a shape with ID my-shape gets class bXktc2hhcGU (base64 encoding of "my-shape").Unique identifiers: Each diagram gets a deterministic hash prefix (e.g., d2-1234567890) used for clip paths, gradients, and other SVG elements to prevent conflicts when multiple diagrams are on the same page.

Element IDs: All shape elements get CSS classes with base64-encoded IDs for safe CSS targeting. For example, a shape with ID my-shape gets class bXktc2hhcGU (base64 encoding of "my-shape").Unique identifiers: Each diagram gets a deterministic hash prefix (e.g., d2-1234567890) used for clip paths, gradients, and other SVG elements to prevent conflicts when multiple diagrams are on the same page.

Unique identifiers: Each diagram gets a deterministic hash prefix (e.g., d2-1234567890) used for clip paths, gradients, and other SVG elements to prevent conflicts when multiple diagrams are on the same page.

PNG exports work by Playwright spinning up a headless browser, putting the SVG onto it, and taking a screenshot. The first invocation of Playwright will download its dependencies, if they don't already exist on the machine.

If you get a message like err: failed to launch Chromium, you can try installing Playwright dependencies outside of D2 on your machine. For example:See #744 for more.

PDF exports are the result of taking PNG exports and placing them on PDF pages, along with headers and fonts. As such, dependencies needed for PNG exports are also needed for PDF exports.

PDF is more interactive than PNG, but less interactive than SVG.

For example, animate keyword won't show up in PDF exports like they would in SVG.

But links can still be clickable in PDFs.

Similar to PDF exports. This export format is useful for giving presentations when used with composition (e.g. diagram with multiple Layers, Scenarios, Steps).

This export format is useful for giving presentations when used with short compositions. For example, show two Scenarios, show a couple of steps. Something that the audience can digest in a loop that lasts a couple of seconds without needing to flip through it manually.

ASCII outputs are new as of 0.7.1. They are to be considered in beta, and many diagrams may not render correctly.

ASCII exports render diagrams as text-based art, perfect for documentation, terminals, and environments where graphical formats aren't suitable. D2 automatically detects the .txt file extension and renders in ASCII format.

D2 supports two ASCII character modes:

Uses Unicode box-drawing characters for cleaner output:

Uses basic ASCII characters for maximum compatibility:

D2 accepts - in place of the input and/or output arguments. SVG is used as the format for Stdout output.

For example, this writes a D2 script of x -> y and outputs it to a file example.svg.

---

## Variables can be nested​

**URL:** https://d2lang.com/tour/vars/

**Contents:**
- Variables & Substitutions
- Variables can be nested​
- Variables are scoped​
- Single quotes bypass substitutions​
- Spread substitutions​
- Configuration variables​

vars is a special keyword that lets you define variables. These variables can be referenced with the substitution syntax: ${}.

Use . to refer to nested variables.

They work just like variable scopes in programming. Substitutions can refer to variables defined in a more outer scope, but not a more inner scope. If a variable appears in two scopes, the one closer to the substitution is used.

If x is a map or an array, ...${x} will spread the contents of x into either a map or an array.

Some configurations can be made directly in vars instead of using flags or environment variables.

This is equivalent to calling the following with no vars:

Flags and environment variables take precedence.In other words, if you call D2_PAD=2 d2 --theme=1 input.d2, it doesn't matter what theme-id and pad are set to in input.d2's d2-config; it will use the options from the command.

In other words, if you call D2_PAD=2 d2 --theme=1 input.d2, it doesn't matter what theme-id and pad are set to in input.d2's d2-config; it will use the options from the command.

data is an anything-goes map of key-value pairs. This is used in contexts where third-party software read configuration, such as when D2 is used as a library, or D2 is run with an external plugin.For example,

---

## Mono fonts​

**URL:** https://d2lang.com/tour/fonts/

**Contents:**
- Fonts
- Mono fonts​
- Sketch font​

D2 uses 4 font families:

Currently on the CLI, you can customize fonts by replacing Source Sans Pro with your own TTF files through the following flags:

These should point to a .ttf file, for example:

It's advisable to supply either none or all of the fonts, for consistency. If you supply one but not all of the fonts, it will fall back to Source Sans Pro for the missing styles. For example, if you give a --font-regular, --font-bold, and --font-semibold, then the italic will remain as Source Sans Pro Italic.

If you'd like to customize the mono fonts:

In sketch mode, if you supply a font, it will replace the default hand-drawn font family instead of Source Sans Pro.

---

## 

**URL:** https://d2lang.com/tour/experience/

**Contents:**
- A diagramming dev tool

D2 is designed towards a single goal: turn diagramming into a pleasant experience for engineers. Plenty of tools can claim to do that for simple diagrams, but you stop having a good time as soon as you get to even slightly complex diagrams — the ones that most need to exist.

Why is that? Because most diagramming tools today are design tools, not dev tools. They give you a blank canvas and a drag-and-drop toolbar like you'd see on Figma or Photoshop, and treat their intended workflow as a design process. Engineers are not visual designers, and the lack of ability to spatially architect a system should not block the creation of valuable documentation. Every drag and drop shouldn’t require planning, and updates shouldn’t be a frustrating exercise in moving things around and resizing to make room for the new piece. Declarative Diagramming removes that friction.

Before Hashicorp introduced Terraform to let engineers write infrastructure as text, they were clicking around AWS and Google Cloud consoles to configure their infrastructure. Nowadays, that's just unprofessional. Where's the review process, the rollback steps, the history and version control? It's hard to believe that the future of visual documentation in companies around the world will predominantly be made with drag-and-drop design tools.

---

## models.d2​

**URL:** https://d2lang.com/tour/model-view/

**Contents:**
- Model-view
- models.d2​
- access-view.d2​
- ssh-view.d2​

A popular pattern defines your models once, and then reuses it across a number of different views.

---

## Show only top-level​

**URL:** https://d2lang.com/tour/models/

**Contents:**
- Models
- Show only top-level​
- Show only connection to X​
- Show only likes​
- Utilizing imports​

Let's say you want to define all models and relationships between models once, then display them in different ways.

First, let's define the models and relationships.

We will use this as the example for multiple views of the same model. How do we treat these as models and not just ordinary shapes and connections? We use the following keywords:

Since models are meant to be invisible until used, we define models at the top of our diagram and suspend all of them with the following globs.

We then use globs to selectively unsuspend the models we want to show. Let's take a look at some use cases.

If you haven't yet, please familiarize yourself with globs.

As you may have noticed, each of these examples repeated the initial models. You can further apply the "one model" principle by defining models once in their own file and importing them. See the import model-view pattern for more.

---

## Tooltips​

**URL:** https://d2lang.com/tour/interactive/

**Contents:**
- Interactive
- Tooltips​
- Links​

Tooltips are text that appear on hover. They serve two purposes:

Try it out, hover over x and y. Notice that they have an icon indicating that they have a tooltip.

When you export to a static format like PNG, D2 will

Tooltips are implemented with HTML title tags, which have basic support for text formatting. Markdown won't be rendered as expected in tooltips.

Links are like tooltips, except you click to go to an external link.

When the link contains the # character as part of a URI fragment, e.g., https://example.com/page#fragment, remember that the fragment will be treated as a comment if unquoted and unescaped.

Try clicking on each.

---

## Parent reference​

**URL:** https://d2lang.com/tour/linking/

**Contents:**
- Linking between boards
- Parent reference​
- Backlinks​

We've introduced link before as a way to jump to external resources. They can also be used to create interactivity to jump to other boards. We'll call these "internal links".

Example of internal link:

If your board name has a ., use quotes to target that board. For example:

The underscore _ is used to refer to the parent scope, but when used in link values, they refer not to parent containers, but to parent boards.

Notice how the navigation bar at the top is clickable. You can easily return to the root or any ancestor page by clicking on the text.

---

## General​

**URL:** https://d2lang.com/tour/faq/

**Contents:**
- Frequently asked questions (FAQ)
- General​
  - How does this compare to Mermaid, Graphviz, PlantUML?​
  - Is this designed for small diagrams or complex ones?​
  - Does the D2 CLI collect telemetry?​
  - Does D2 need a browser to run?​
  - Can D2 run on a browser?​
  - Can I use D2 online?​
- Layouts​
  - Can an object be part of more than 1 container?​

We've created a website with detailed comparisons: https://text-to-diagram.com. It is a community effort where anyone can add examples or request changes or compare features. The maintainers of Mermaid have contributed to it.

Both. The syntax is kept minimal and unstructured to make small diagrams with as little lines as possible. At the same time, the language includes IDE features like an autoformatter, error messages, and comments to maintain large diagrams.

However, it is not designed for "big data". We do not test D2 on thousands of nodes.

No, D2 does not use an internet connection after installation, except to check for version updates from GitHub periodically.

No, D2 can run entirely server-side.

Yes, with WebAssembly. D2 runs on https://play.d2lang.com this way.We are working on including the build with the releases, as well as provide instructions and examples so you can include it in your browser projects.

https://play.d2lang.com

...e.g., an item in the middle of a venn diagram.

Not currently and not in the near future. See discussion for more.

Not currently, but in the near future. See discussion for more.

SVG exports can have some interactive elements when using links and tooltips. However, interactivity in SVG can be disabled depending on environment. There are several ways to include SVGs on a web page.

tldr; when it's treated as an image, the interactivity is lost.

---

## Communicating ideas​

**URL:** https://d2lang.com/tour/slack/

**Contents:**
- D2 app for Slack
  - The fastest way to explain what you mean mid-conversation​
- Communicating ideas​
- Put large diagrams in the conversation for discussion​
- Additional information​

Ever have like 6 rounds of back-and-forth to explain what you mean when it's a pretty simple model you're explaining? The D2 app for Slack lets you create beautiful diagrams on the fly with a /d2 command.

Slack requires configurations that can only be set on a third-party platform. So you'll need to create a Terrastruct account (paid) to use the D2 app for Slack. Terrastruct does not collect any data from Slack.

Your browser does not support the video tag.

Your browser does not support the video tag.

---

## Readability > prototyping speed​

**URL:** https://d2lang.com/tour/design/

**Contents:**
- Design decisions
- Readability > prototyping speed​
- Warnings > errors​
- Good defaults​
- Optimized for desktops and servers​
- Singular use case: documenting software​
- Design the system, not the diagram​
- Whiteboard-fit​

The following are design decisions that guide the development of D2. We've tried our best to avoid the mistakes of the past and take inspiration from the most successful modern programming and configuration languages.

Design decisions inherently mean tradeoffs, some of which you may disagree with. But, if you're a programmer, D2 is built for you, and we believe you'll find the sum of these decisions to be a language that makes you feels at home.

These will inevitably evolve as the language continues to evolve.

Both readability and prototyping speed are important, but when a decision is one or the other, D2 usually favors readability.

Most of the time, it's not either/or. Good programming language features usually result in higher vectors in both directions. D2's syntax is light and designed such that autofmt always gets it right for you, consistent across projects.

Hopefully you'll find a good balance between ease of use, prototyping speed, and readability, in that order. What D2 specifically avoids is terse, compact syntax that inhibits all three.

For example, here's two ways to define a cylinder.

D2's is a little less compact but a lot more readable. It's also more writeable, by which I mean you don't forget that a cylinder is called a cylinder, but it's easy to forget that [(x)] is a cylinder.

D2 will compile whenever possible. For example, say you apply a class that doesn't exist, or add a style that has no effect on a particular shape. If the user error is one that D2 can ignore, it will compile successfully and, at most, warn. There's nothing more annoying than commenting out some code while debugging, and getting a stop-the-world error message that you have an unused variable.

Default, zero-customization D2 should produce good diagrams. That requires being opinionated on what a good default should be. For example, D2 ships with a default theme. Instead of keeping things open-ended with monochrome shapes, pleasant colors are the default.

D2 has a robust CLI with a built-in watch mode, maintained man page, and allows reading from stdin and writing to stdout. Images and fonts are by default embedded into the diagram so that exported diagrams are standalone -- they'll look the same everywhere. D2 supports a wide variety of formats like PPT and GIF. It allows imports, such that you can modularize your diagram into multiple files. There's a language API to programmatically edit and write D2. All of these are antithetical to a web library for browser rendering. D2 intends to ship and maintain a web library for that purpose, but it'll be trimmed down from the full feature set and secondary in priority.

D2 is focused on being useful to software engineers for documenting software. We are not a general-purpose visualization tool. Other languages may support mind maps, Gantt charts, Sankey, venn diagrams, and have the capability to draw a map of the United States. D2 does none of those and will not support these.

In D2, these are considered bloat. Stretching a language thin across such a large surface area of different diagram types essentially splits it into N different mini-DSLs within a DSL. Syntax can hardly evolve when it has to support N completely different diagram types. And it's counter to the original purpose of a DSL which is to make a subset task more convenient.

The purpose of D2 is to describe the system you're documenting. The language should make a clear separation between design of the system and design of the diagram.

Consider what it takes to customize styles in a Graphviz diagram:

Imagine if you couldn't separate HTML and CSS and it all had to be inlined.

Of course, good aesthetics are essential to good documentation. D2 certainly prioritizes aesthetics, but it must be decoupled with the content.

D2 is the only language that allows you to define just nodes and edges, and import all the styles in a separate file, and swap out that file for different aesthetics.

While "graph" and "diagram" are often interchangeable terms, for D2's purposes, a diagram is a simplified representation that can fit on a large whiteboard. After a certain number of nodes and edges, e.g. 1000 nodes, the representation becomes more like a graph from graph theory than a software architecture diagram. Their use case is less understanding each individual shape and connection and more seeing the general patterns. D2 is not designed for this use case. There are much better tools for that.

---

## Layout engines​

**URL:** https://d2lang.com/tour/layouts/

**Contents:**
- Overview
- Layout engines​
  - Layout-specific functionality​
- Direction​
  - Directions per container (TALA only)​

D2 supports using a variety of different layout engines. The choice of layout engines can significantly influence your overall diagram. Each layout also has varying degrees of support for certain keywords. Though we try our best to keep things consistent, ultimately we have the most control over our custom-built layout engine and are limited by what the other layout engines support.

You can choose whichever layout engine you like and works best for the diagram you're making. Each one has its tradeoffs, visit the individual pages to learn more.

To see available layouts on your machine, you can run d2 layout. Each layout engine can also have specific configurable flags, which you can find by running d2 layout [engine], e.g. d2 layout dagre.

To specify the layout used, you can either set the flag --layout=dagre or set it as an environment variable, $D2_LAYOUT=dagre.

Some keywords and functionality are only available for certain layout engines. We authored and maintain TALA, so it is the only one we have full control over. We write shims for Dagre and ELK, but some things are fundamental to the layout engines, and the only way to support everything we want to do on those is to fork (which we may eventually do).

These are mentioned in other parts of the doc and aggregated here:

Set direction to one of the following to influence an explicit direction your diagram flows towards.

Directions can only be set at a global level for all the layout engines except TALA. This is a limitation of their algorithms, which are hierarchical and only work in one direction. We are investigating ways to hack it to work.

---

## Style keywords​

**URL:** https://d2lang.com/tour/style/

**Contents:**
- Styles
- Style keywords​
- Opacity​
- Stroke​
- Fill​
- Fill Pattern​
- Stroke Width​
- Stroke Dash​
- Border Radius​
- Shadow​

If you'd like to customize the style of a shape, the following reserved keywords can be set under the style field.

Below is a catalog of all valid styles, applied individually to this baseline diagram.

The following SVGs are rendered with direction: right, but omitted from the shown scripts for brevity.

Want to change the default styles for shapes and/or connections? See globs to change defaults.

Float between 0 and 1.

CSS color name, hex code, or a subset of CSS gradient strings.

For sql_tables and classes, stroke is applied as fill to the body (since fill is already used to control header's fill).

CSS color name, hex code, or a subset of CSS gradient strings.

For sql_tables and classes, fill is applied to the header.

Integer between 1 and 15.

Integer between 0 and 10.

Integer between 0 and 20.

border-radius works on connections too, which controls how rounded the corners are. This only applies to layout engines that use corners (e.g. ELK), and of course, only has effect on connections whose routes have corners.

Specifying a very high value creates a "pill" effect.

Currently the only option is to specify mono. More coming soon.

Integer between 8 and 100.

CSS color name, hex code, or a subset of CSS gradient strings.

For sql_tables and classes, font-color is applied to the header text only (theme controls other colors in the body).

text-transform changes the casing of labels.

Some styles are applicable at the root level. For example, to set a diagram background color, use style.fill.

Currently the set of supported keywords are:

All diagrams in this documentation are rendered with pad=0. If you're using stroke to create a frame for your diagram, you'll likely want to add some padding.

---

## Render of overview.d2​

**URL:** https://d2lang.com/tour/nested-composition/

**Contents:**
- Nested composition
  - overview.d2​
  - serviceB.d2​
  - data.d2​
- Render of overview.d2​

Imports make large compositions much more manageable.

Large diagrams like the ones that take you from high-level overview to low-level details becomes possible to cleanly construct.

Rendering overview.d2 gives us a nested diagram while each file is kept flat and readable.

---

## Help wanted​

**URL:** https://d2lang.com/tour/help/

**Contents:**
- Contributing
- Help wanted​

Contributions are welcome! Please see the full doc on contributing on D2's Github: https://github.com/terrastruct/d2/blob/master/docs/CONTRIBUTING.md.

The above doc is for contributing to D2 core. However, D2's community often requests things that the core team don't have the bandwidth to do (until D2 reaches 1.0, we're aggressively prioritizing improvements that make D2 better for the majority of users). Below is a list of features that could use your help. If you're interested in taking the initiative, feel free to just start, or you can comment on a GitHub issue, discuss in Discord, or email us (alex at terrastruct).

Want to add something to this wishlist? Just make an Issue on D2's GitHub!

---

## Near​

**URL:** https://d2lang.com/tour/positions/

**Contents:**
- Positions
- Near​
  - Giving your diagram a title​
- A winning strategy
  - Creating a legend​
  - Longform description or explanation​
- LLMs
- Label and icon positioning​
  - Outside and border​
- Tooltip near​

In general, positioning is controlled entirely by the layout engine. It's one of the primary benefits of text-to-diagram that you don't have to manually define all the positions of objects.

However, there are occasions where you want to have some control over positions. Currently, there are two ways to do that.

D2 allows you to position items on set points around your diagram.

top-left, top-center, top-right,center-left, center-right,bottom-left, bottom-center, bottom-right

center-left, center-right,bottom-left, bottom-center, bottom-right

bottom-left, bottom-center, bottom-right

Let's explore some use cases:

The Large Language Model (LLM) is a powerful AI system that learns from vast amounts of text data. By analyzing patterns and structures in language, it gains an understanding of grammar, facts, and even some reasoning abilities. As users input text, the LLM predicts the most likely next words or phrases to create coherent responses. The model continuously fine-tunes its output, considering both the user's input and its own vast knowledge base. This cutting-edge technology enables LLM to generate human-like text, making it a valuable tool for various applications.

The near can be nested to label and icon to specify their positions.

When positioning labels and icons, in addition to the values that near can take elsewhere, an outside- prefix can be added to specify positioning outside the bounding box of the shape.

outside-top-left, outside-top-center, outside-top-right,

outside-left-center, outside-right-center,

outside-bottom-left, outside-bottom-center, outside-bottom-right

Note that outside-left-center is a different order than center-left.

You can also add border-x prefix to specify the label being on the border.

Usually, tooltip is a on-hover effect. However, if you specify a near field, it will permanently show.

God has abandoned this pipeline

Works in TALA only. We are working on shims to make this possible in other layout engines.

You can also set near to the absolute ID of another shape to hint to the layout engine that they should be in the vicinity of one another.

Notice how the text is positioned near the aws node and not the gcloud node.

On the TALA engine, you can also directly set the top and left values for objects, and the layout engine will only move other objects around it.

For more on this, see page 17 of the TALA user manual.

---

## Basics​

**URL:** https://d2lang.com/tour/shapes/

**Contents:**
- Shapes
- Basics​
- Example​
- 1:1 Ratio shapes​

You can declare shapes like so:

You can also use semicolons to define multiple shapes on the same line:

By default, a shape's label is the same as the shape's key. But if you want it to be different, assign a new label like so:

By default, a shape's type is rectangle. To specify otherwise, provide the field shape:

Keys are case-insensitive, so postgresql and postgreSQL will reference the same shape.

There are other values that shape can take, but they're special types that are covered in the next section.

Some shapes maintain a 1:1 aspect ratio, meaning their width and height are always equal.

For these shapes, if you have a long label that make the shape wider, D2 will also make the shape taller to maintain the 1:1 ratio.

If you manually set width and height on a 1:1 ratio shape, both dimensions will be set to the larger of the two values to maintain the aspect ratio.

---

## classes.d2​

**URL:** https://d2lang.com/tour/modular-classes/

**Contents:**
- Modular classes
- classes.d2​
- main.d2​

This pattern mirrors web development, separating HTML and CSS.

---

## Setting theme on the CLI​

**URL:** https://d2lang.com/tour/themes/

**Contents:**
- Themes
  - They apply to special shapes like tables too​
- Rendered with theme "Grape soda"
- Rendered with theme "Vanilla nitro cola"
- Setting theme on the CLI​
- Dark theme​
- Special themes​
- Customizing themes​
  - Color codes​

D2 comes with many themes that make your diagram look professional and ready to insert into blogs and wikis.

To specify the theme used, you can set the flag -t, --theme.

You can also use an environment variable.

To see which themes are available, run

Dark themes are not set by default, so your diagram will look the same regardless of whether the user's system preferences are light or dark.

All diagrams in these docs have a dark theme. Try toggling your system preference between light and dark and see how it changes.

If you'd like your diagram to adapt and switch to a dark theme when the user's system preference is dark, you can do so by specifying the following flag.

Like regular themes, this can also be set with an environment variable.

The themes are catalogued separately into light and dark, but there's nothing stopping you from passing a dark theme ID to theme for your diagram to always be dark (or vice versa, to give a surprise to dark mode users).

An example of a dark theme (this one's an image not an SVG, so it won't change according to your system preference).

Certain, special themes do more than just color.

For example, when you apply the Terminal theme, the following attributes are set as default:

Source code for the above diagram (rendered with ELK) is as follows. Notice that many of the properties apparent in the diagram do not appear in the source, such as the casing of the labels, because the special theme uses different defaults.

You can override theme values to customize existing themes or replace them entirely with your own theme.

This is controlled by two configuration variables:

Adding this snippet to the above code results in the following diagram.

Not all color codes are currently used right now, but that may change in the future for new things that come to D2.

---

## 

**URL:** https://d2lang.com/tour/man/

**Contents:**
- CLI manual

The following is a copy of the man (manual) for the CLI. It is identical to the output you would get by installing the CLI and running man d2.

---

## 

**URL:** https://d2lang.com/tour/composition-formats/

**Contents:**
- Export formats

Since a diagram composed of multiple boards can't be represented as a single image, the export options are different.

---

## Basics​

**URL:** https://d2lang.com/tour/connections/

**Contents:**
- Connections
- Basics​
  - Connection labels​
  - Connections must reference a shape's key, not its label.​
- Example​
- Repeated connections​
- Connection chaining​
- Cycles are okay​
- Arrowheads​
- Referencing connections​

Connections define relationships between shapes.

Hyphens/arrows in between shapes define a connection.

If you reference an undeclared shape in a connection, it's created (as shown in the hello world example).

There are 4 valid ways to define a connection: -- -> <- <->

Repeated connections do not override existing connections. They declare new ones.

For readability, it may look more natural to define multiple connection in a single line.

To override the default arrowhead shape or give a label next to arrowheads, define a special shape on connections named source-arrowhead and/or target-arrowhead.

It's recommended the arrowhead labels be kept short. They do not go through autolayout for optimal positioning like regular labels do, so long arrowhead labels are more likely to collide with surrounding objects.

If the connection does not have an endpoint, arrowheads won't do anything.For example, the following will do nothing, because there is no source arrowhead.

For example, the following will do nothing, because there is no source arrowhead.

You can reference a connection by specifying the original ID followed by its index.

---

## 

**URL:** https://d2lang.com/tour/vim/

**Contents:**
- Vim plugin

D2 has an official, creator-maintained plugin for Vim. You can use any plugin manager to include terrastruct/d2-vim. For example:

Automatic indentation and syntax highlighting are fully supported and make working with the D2 language far more pleasant. Autoformat on each save is planned.

The syntax highlighting will even catch basic errors for you if your color theme highlights illegal syntax.

Github: https://github.com/terrastruct/d2-vim

---

## 

**URL:** https://d2lang.com/tour/composition/

**Contents:**
- Intro to Composition

This section's documentation is incomplete. We'll be adding more to this section soon.

D2 has built-in mechanisms for you to compose multiple boards into one diagram.

For example, this is a composition of 2 boards, exported as an animated SVG:

The way to define another board in a D2 diagram is to use 1 of 3 keywords. Each of these declare boards with different inheritance rules.

Each one serves different use cases. The example above is achieved by defining a Scenario (the scenario of when we have to deploy a hotfix).

Thus far, all D2 diagrams we've encountered are single-board diagrams, the root board.

Composition in D2 is when you use one of those keywords to declare another board.

So now we have two boards: root and numbers. They cannot be visible at the same time of course, so exports have to accommodate these more dynamic diagrams, such as the animated SVG you see above.

Composition is one of D2's most powerful features, as you'll see from the use cases in this section.

---

## Reference​

**URL:** https://d2lang.com/tour/elk/

**Contents:**
- ELK
- Reference​
- Pros​
- Cons​

ELK is a mature, hierarchical layout, actively maintained by an academic research group at Christian Albrechts University in Kiel.

https://www.eclipse.org/elk/reference.html

---

## History​

**URL:** https://d2lang.com/tour/version-visualization/

**Contents:**
- Version visualization
- History​
- Compare​

You want to understand how the schema of a system has evolved over time. As long as the diagram is modularized with imports, such a visualization is easy to whip up.

Since you want how users.d2 looked like at v0.1, you use git to get that version:

You're a manager at Apple who has two teams secretly working on the same product for multiple years. After years of iterating in their silos, you form a committee to compare the two results. The evaluation starts by comparing their design decisions in an overarching diagram projected in a dark room behind a closed door.

And then you checkout the corresponding diagrams from the different repositories.

The rendered diagram is left as an exercise to the reader.

---

## It won't compile a specific label or value​

**URL:** https://d2lang.com/tour/troubleshoot/

**Contents:**
- Troubleshooting
- It won't compile a specific label or value​
- The text is rendered too wide/long​
- Connections look cluttered​
- Reserved keywords as regular keys​
- My diagram is breaking with HTML in Markdown​
- Markdown SVGs won't render in certain SVG viewers​
- My SVG isn't interactive when I embed into HTML​
- Non-ASCII text breaks stuff​

It probably has some reserved characters, wrap it around ' or ".

If you have a highly connected diagram with many connections on shapes with short labels, you will get better results by manually settings widths and heights on them. By default, D2 adds a minimal amount of padding to shapes past the label dimensions. When a shape has many connections, increasing dimensions will give it more surface area for the connections to route aesthetically to.

If you'd like to use a reserved keyword as a key, just quote it:

Your HTML must be semantic to be parsed in SVG XML correctly, e.g. use <br/> instead of <br>.

D2's Markdown support is added via xhtml foreign objects, which means the SVG viewer must have HTML rendering capabilities. The vast majority of SVG viewing is, but if you intend to use a pure SVG editor on D2 diagrams that don't have such capabilities (e.g. Adobe Illustrator), it won't render correctly there.

There's a few different ways to embed SVG into HTML, each with tradeoffs. If you use plain <img> tags, interactivity is blocked. Here are two good resources to learn more:

D2 works with any language, but sometimes non-ASCII characters look like reserved characters when they're not.

The character ： is not the same as the ASCII :, and so it won't register as a label. For foreign language diagrams, please take care to use the ASCII versions of special characters like :, ;, ., among others.

---

## 

**URL:** https://d2lang.com/tour/sketch/

**Contents:**
- Sketch (Hand-drawn)

D2 can render diagrams to give the aesthetic of a hand-drawn sketch.

See our blog post on sketch mode

---

## Benefits​

**URL:** https://d2lang.com/tour/studio/

**Contents:**
- D2 Studio
- Benefits​
- Example​

D2 Studio is to D2 as IntelliJ is to Java (or XCode is to Swift, or GoLand is to Go, etc).

D2 is a programming language, and you can write and run it anywhere -- the end result is the same. But the medium changes the experience. Writing D2 on a code editor beats writing it on Apple Notes. D2 Studio is the optimized, feature-packed IDE for D2, turning it into a professional, collaborative diagramming tool for the whole team.

D2 Studio is one of the ways the company behind D2 monetizes. It's free to try and evaluate, and like other IDEs you might try for your code, you can easily onboard by importing existing D2 code and offboard the same way. No lock-in.

Here's an example of a multi-layer D2 diagram presented in D2 studio's web interface:

---

## Line comments​

**URL:** https://d2lang.com/tour/comments/

**Contents:**
- Comments
- Line comments​
- Block comments​

D2 has line comments and block comments.

Line comments begin with a hash.

They can be added as their own line

Or at the end of a line

Block comments begin and end with three double quotes:

---

## 

**URL:** https://d2lang.com/tour/layers/

**Contents:**
- Layers

A "Layer" represents "a layer of abstraction". Each Layer starts off as a blank board, since you're representing different objects at every level of abstraction.

Try clicking on the objects.

---

## Unquoted strings​

**URL:** https://d2lang.com/tour/strings/

**Contents:**
- Strings
- Unquoted strings​
- Quoted strings​
- Autoformat​

You may have noticed by now that the examples thus far have not used any quotes. It's our goal for D2 to be easy to use and quotes tend to get in the way of that.

Quotes add friction in several ways. First, you have to close opened quotes. Second, you have to remember whether to use single or double quotes. Lastly, they add syntactical noise.

That means for the most part, don't worry about quotes!

Leading and trailing whitespace is trimmed.

Unquoted strings may not contain certain characters that are used elsewhere in the language. The syntax highlighting will make it clear if you're using a forbidden symbol.

If you need to use such symbols, you can use single or double quoted strings:

You would use double quotes if your text contains single quotes, and vice-versa. If it includes both, use double quotes and simply \ escape as you would in other languages.

If your block string's indent is not sufficient, the autoformatter will correct it.

Autoformat will check if there are any non empty lines with insufficient indent. If so, all lines will be prepended with the correct amount of indent (while respecting existing common indent). This way you don't have to fuss with your editor to get the indent right. Just paste any code on the first column after starting a block string and autoformat will correct it for you.

You can use tabs to indent block strings after indenting to the base block string indent with two spaces. Any tabs in the base block string indent will be automatically converted to two spaces.

---

## 

**URL:** https://d2lang.com/tour/steps/

**Contents:**
- Steps

A "Step" represents a step in a sequence of events.

Each Step inherits from its the Step before it. The first step inherits from its parent, whether that's a Scenario or Layer.

Notice how in Step 3 for example, the object "Approach road" exists even though it's not defined, because it was inherited from Step 2, which inherited it from Step 1.

---

## Reference​

**URL:** https://d2lang.com/tour/dagre/

**Contents:**
- Dagre
- Reference​
- Pros​
- Cons​

Dagre is D2's default layout engine.

https://github.com/dagrejs/dagre

---

## Hiding shapes​

**URL:** https://d2lang.com/tour/legend/

**Contents:**
- Legend
- Hiding shapes​
- Rename "legend"​

Use a special variable, d2-legend, to declare a legend.

Since a -> b declares 3 things (1 connection and 2 shapes), 3 things will show up on the legend. If you only intended to show the connection in the legend, you can set the opacity of shapes to exclude them from the legend.

You may rename "legend" by simply giving it a label. This is particularly useful for non-English diagrams.

---

## 

**URL:** https://d2lang.com/tour/discord/

**Contents:**
- Discord plugin
  - The fastest way to explain what you mean mid-conversation​

Keep your projects moving by connecting Terrastruct and Discord. Compile D2 codeblocks by opening the context menu on a D2 codeblock, going to Apps and clicking Compile D2.

Configure your exports by using /d2 inside Discord.

Your browser does not support the video tag.

---

## 

**URL:** https://d2lang.com/tour/vscode/

**Contents:**
- VSCode extension

D2 has an official, creator-maintained extension for VSCode. It's searchable and downloadable through the VSCode marketplace for free.

Automatic indentation and syntax highlighting are fully supported and make working with the D2 language far more pleasant. Split-screen diagramming within VSCode is planned.

The syntax highlighting will even catch basic errors for you if your color theme highlights illegal syntax.

Github: https://github.com/terrastruct/d2-vscode

---

## Standalone text is Markdown​

**URL:** https://d2lang.com/tour/text/

**Contents:**
- Text
- Standalone text is Markdown​
- I can do headers
- Markdown label​
- I can do headers
- Most languages are supported​
- LaTeX​
- Code​
- Advanced: Non-Markdown text​
- Advanced: Block strings​

And other normal markdown stuff

If you want to set a Markdown label on a shape, you must explicitly declare the shape.

And other normal markdown stuff

D2 most likely supports any language you want to use, including non-Latin ones like Chinese, Japanese, Korean, even emojis!

You can use latex or tex to specify a LaTeX language block.

A few things to note about LaTeX blocks:

D2 runs on the latest version of MathJax, which has a lot of nice things but unfortunately does not have linebreaks. You can kind of get around this with the displaylines command. See below.

Change md to a programming language for code blocks

See the Chroma library for a full list of supported languages.D2 also provides convenient short aliases: md → markdown tex → latex js → javascript go → golang py → python rb → ruby ts → typescript If a language isn't recognized, D2 will fall back to plain text rendering without syntax highlighting.

D2 also provides convenient short aliases: md → markdown tex → latex js → javascript go → golang py → python rb → ruby ts → typescript If a language isn't recognized, D2 will fall back to plain text rendering without syntax highlighting.

If a language isn't recognized, D2 will fall back to plain text rendering without syntax highlighting.

In some cases, you may want non-Markdown text. Maybe you just don't like Markdown, or the GitHub-styling of Markdown that D2 uses, or you want to quickly change a shape to text. Just set shape: text.

What if you're writing Typescript where the pipe symbol | is commonly used? Just add another pipe, ||.

Actually, Typescript uses || too, so that won't work. Let's keep going.

There's probably some language or scenario where the triple pipe is used too. D2 actually allows you to use any special symbols (not alphanumeric, space, or _) after the first pipe:

D2 includes the following LaTeX plugins:

---

## Install script​

**URL:** https://d2lang.com/tour/install/

**Contents:**
- Install
- Install script​
- Install from source​
- Try it out

There are more detailed install instructions for Mac, Windows, and Linux, using a variety of methods, here. This page is an abridged version.

The recommended way to install is to run our install script, which will figure out the best way to install based on your machine. E.g. if D2 is available through a package manager installed, it will use that package manager.

Follow the instructions, if any. Test your installation was successful by running d2 version.

If you want to uninstall:

Alternatively, you can install from source:

You can also download precompiled binaries specific to your OS on the Github releases page: https://github.com/terrastruct/d2/releases.

It should have spun up a local web browser that will automatically refresh when you change input.d2. Modify input.d2 as you go through this tour to follow along.

---

## Reference​

**URL:** https://d2lang.com/tour/tala/

**Contents:**
- TALA
- Reference​
- Pros​
- Cons​

Proprietary layout engine developed by Terrastruct, designed specifically for software architecture diagrams.

TALA is a separate install from D2, to keep a clean cut between 100% free and open-source D2, and proprietary, closed-source TALA. You can download it here: https://github.com/terrastruct/tala.

https://terrastruct.com/tala/

For the most up-to-date information, please see the official TALA manual.

---

## Basics​

**URL:** https://d2lang.com/tour/uml-classes/

**Contents:**
- UML Classes
- Basics​
- Visibilities​
- Full example​

D2 fully supports UML Class diagrams. Here's a minimal example:

Each key of a class shape defines either a field or a method.

The value of a field key is its type.

Any key that contains ( is a method, whose value is the return type.

A method key without a value has a return type of void.

If you'd like to use a reserved keyword, wrap it in quotes.

You can also use UML-style prefixes to indicate field/method visibility.

See https://www.uml-diagrams.org/visibility.html

Here's an example with differing visibilities and more complex types:

---

## Connection classes​

**URL:** https://d2lang.com/tour/classes/

**Contents:**
- Classes
- Connection classes​
- Overriding classes​
- Multiple classes​
  - Order matters​
- Advanced: Using classes as tags​

Classes let you aggregate attributes and reuse them.

As a reminder of D2 syntax, you can apply classes to connections both at the initial declaration as well as afterwards.

On initial declaration:

If your object defines an attribute that the class also has defined, the object's attribute overrides the class attribute.

You may use arrays for the value as well to apply multiple classes.

When multiple classes are given, they are applied left-to-right.

If you want to post-process D2 diagrams, you can also use classes to arbitrarily tag objects. Any class you apply is written into the SVG element as a class attribute. So for example, you can then apply custom CSS like .stuff { ... } (or use Javascript for onclick handlers and such) on a web page that D2 SVG is embedded in.

---

## Official​

**URL:** https://d2lang.com/tour/extensions/

**Contents:**
- Overview
- Official​
- Community​

Officially developed and maintained by the creators of D2.

Community developed plugins and extensions. Have one you'd like to share? Please open an issue and we're happy to include your's!

---

## Width and height​

**URL:** https://d2lang.com/tour/grid-diagrams/

**Contents:**
- Grid Diagrams
- Width and height​
- Cells expand to fill​
- Dominant direction​
- Gap size​
  - Gap size 0​
    - Like this map of Japan​
    - Or a table of data​
  - Gap size 0​
- Connections​

Grid diagrams let you display objects in a structured grid.

Two keywords do all the magic:

Setting just grid-rows:

Setting just grid-columns:

Setting both grid-rows and grid-columns:

To create specific constructions, use width and/or height.

Notice how objects are evenly distributed within each row.

When you define only one of row or column, objects will expand.

Notice how Voters and Non-voters fill the space.

When you apply both row and column, the first appearance is the dominant direction. The dominant direction is the order in which cells are filled.

Since grid-rows is defined first, objects will fill rows before moving onto columns.

But if it were reversed:

It would do the opposite.

These animations are also pure D2, so you can animate grid diagrams being built-up. Use the animate-interval flag with this code. More on this later, in the composition section.

You can control the gap size of the grid with 3 keywords:

Setting grid-gap is equivalent to setting both vertical-gap and horizontal-gap.

vertical-gap and horizontal-gap can override grid-gap.

grid-gap: 0 in particular can create some interesting constructions:

You may find it easier to just use Markdown tables though, especially if there are duplicate cells. Month Savings Expenses Balance January $250 $150 $100 February $80 $200 -$120 March $420 $180 $240

Connections for grids themselves work normally as you'd expect.

Connections between shapes inside a grid work a bit differently. Because a grid structure imposes positioning outside what the layout engine controls, the layout engine is also unable to make routes. Therefore, these connections are center-center straight segments, i.e., no path-finding.

Currently you can nest grid diagrams within grid diagrams. Nesting other types is coming soon.

A common technique to align grid elements to your liking is to pad the grid with invisible elements.

Consider the following diagram.

It'd be nicer if it were centered. This can be achieved by adding 2 invisible elements.

Elements in a grid column have the same width and elements in a grid row have the same height.

So in this example, a small empty space in "Backend Node" is present.

It's due to the label of "Flask Pod" being slightly longer than "Next Pod". So the way we fix that is to set widths to match.

---

## Basics​

**URL:** https://d2lang.com/tour/sql-tables/

**Contents:**
- SQL Tables
- Basics​
- Foreign Keys​
- Example​

You can easily diagram entity-relationship diagrams (ERDs) in D2 by using the sql_table shape. Here's a minimal example:

Each key of a SQL Table shape defines a row. The primary value (the thing after the colon) of each row defines its type.

The constraint value of each row defines its SQL constraint. D2 will recognize and shorten:

But you can set any constraint you'd like. It just won't be shortened if unrecognized.

You can also specify multiple constraints with an array.

If you'd like to use a reserved keyword, wrap it in quotes.

Here's an example of how you'd define a foreign key connection between two tables:

When rendered with the TALA layout engine or ELK layout engine, connections point to the exact row.

Like all other shapes, you can nest sql_tables into containers and define edges to them from other shapes. Here's an example:

---

## Add shape: image for standalone icon shapes​

**URL:** https://d2lang.com/tour/icons/

**Contents:**
- Icons
- Add shape: image for standalone icon shapes​

We host a collection of icons commonly found in software architecture diagrams for free to help you get started: https://icons.terrastruct.com.

Icons and images are an essential part of production-ready diagrams.

You can use any URL as value.

Using the D2 CLI locally? You can specify local images like icon: ./my_cat.png.

Icon placement is automatic. Considerations vary depending on layout engine, but things like coexistence with a label and whether it's a container generally affect where the icon is placed to not obstruct. Notice how the following diagram has container icons in the top-left and non-container icons in the center.

Icons can be positioned with the near keyword introduced later.

---

## Running formatter​

**URL:** https://d2lang.com/tour/auto-formatter/

**Contents:**
- Autoformat
- Running formatter​

You almost never have to think about style decisions like indentation, newlines, number of hyphens, or spacing. D2's auto-formatter will format your D2 file for you on compile, keeping all your declarations consistent and readable, effortlessly.

When you compile, it becomes

If you're using the d2 CLI, you can run the formatter on files with

The formatter is meant to be integrated into plugins and extensions which automatically call the formatter upon file writing. This functionality is dependent on the plugin.

---

## Patterns​

**URL:** https://d2lang.com/tour/imports-use-cases/

**Contents:**
- Overview
- Patterns​
- Principles​
- More Examples​

The following are examples of some popular use cases for imports. Fundamentally, D2 imports behave just like dependencies in other programming languages, so it is flexible for doing much more than the ones shown here.

Alongside the patterns that imports can be used for, splitting your diagram into multiple files can also fulfill useful principles for organizations:

Some more creative, practical examples of using imports that mix and match the above patterns and principles.

---

## 

**URL:** https://d2lang.com/tour/dimensions/

**Contents:**
- Dimensions

You can specify the width and height of most shapes.

These keywords cannot be set on containers, since containers resize to fit their children.

---

## Layouts​

**URL:** https://d2lang.com/tour/future/

**Contents:**
- Roadmap
- Layouts​
  - How success is measured​
  - Plan​
- Aesthetics​
  - How success is measured​
  - Plan​
- Developer Tooling​
  - How success is measured​
  - Plan​

https://github.com/terrastruct/d2/issues?q=is%3Aopen+is%3Aissue+label%3Afeature

D2's long-term goal is to significantly reduce the amount of time and effort it takes to create and maintain high-quality diagrams for every software team. This is a large, ambitious undertaking that will take many (more) years to get right, and won't ever truly be "done". It's important to focus on what's most impactful towards increasing its utility, in more use cases, especially in these early stages. The top priorities today:

For each of these, there are survey questions that are used to measure progress.

In some instances, you need a diagram to match the exact image in your head. These workflows will always require a design tool, with a drag-and-drop GUI. In other cases, you don't care about exact match, or you can't even picture the end result. The requirements for these types of diagrams are more relaxed -- it only needs to satisfy a set of constraints. These are the types of diagrams that an algorithm can get right -- "automatable". The vast majority of software engineering diagrams are automatable.

Currently, D2 can handle a subset of automatable diagrams well, and increasing coverage is a priority. The primary lever, of course, is layout engines. These are the algorithms that take shapes, labels, icons, connections and hints as input, and lay it out in such a way that is "legible".

There are two components to diagram legibility.

Visual legibility is what algorithms are good at, and they should always outperform humans. The gap increases as diagrams get larger -- it's impossible for me and you to eyeball 20 swaps that end up reducing overall edge distance by 4 pixels.

Semantic legibility is the bigger challenge. Most layout engines stick to a simple "type" of diagram, like hierarchical. But how often do you want your software architecture to be hierarchical? Rarely, and laying it out that way changes the semantics.

D2 uses Dagre by default. Though it is among the best open-source layout engines (used by MermaidJS, perhaps the most popular text-to-diagram tool currently), it still leaves much to be desired. Dagre is unfortunately unmaintained, and only produces hierarchical layouts. Even if it were to be revived, the research papers it's based off of will not evolve out of hierarchical layouts. It also doesn't support containers, which is a non-starter for software architecture diagrams (D2 has shimmed support for it [2]).

Documentation is only useful if it's consumed, and beautiful diagrams are consumed far more than ugly ones. For algorithm-generated diagrams to be a suitable replacement to hand-made, it must be at least as aesthetic. To be consistently preferable to hand-made ones [4], it must be aesthetic out of the box. Customization should then be graduated levels of how much effort you want to expend. Least effort: choose from pre-made themes designed by professional designers. More effort: make and edit your own themes. Most effort: custom-style everything. Most engineers are satisfied at the first and second levels, but D2 must have good support for granular customization.

One deciding factor is the time it takes to get to a presentable diagram. Presentable doesn't mean full of vibrant colors and shadows and design fluff. It does mean consistent colors that increase clarity, on-brand palette of company colors, distinct shapes and arrows -- properties that make a professional diagram you'd be proud of presenting.

Another consideration is how customizable the aesthetics are, and how much effort that customization takes. I wish the bar here could be that customizing via text can get better than the GUI, but I don't believe this to be a possible outcome. If you want a slightly different shade of green, are you going to edit the hex code by typing it? Or would you rather point and click from a gradient. If you want to change the style of 3 objects you're looking at, you can text-search for the names of each of those 3 objects and change them individually. But most of us would rather use the superior input device for precision targeting -- a mouse.

While getting the customization experience to be GUI-level is merely aspirational, D2 can aim to be at least as good as an existing, battle-tested text-based styling language: CSS.

The better support a dev tool has for existing workflows and familiar tools, the more useful it is. D2 has official Vim and VSCode extensions. Features within the language exist solely for bettering editor environments, such as autoformat and being able to parse broken syntax and output multiple, human-readable error messages.

To further support composability, D2 has a built-in API for manipulating the AST at a high-level (more intelligent than just CRUD on AST nodes). This lets anyone build up and edit a diagram programmatically. The goal isn't to enable a specific use case, but rather unforeseen ones for the infinite workflows out there.

D2's plugin system further makes the language extensible. These allow you to add "hooks" to stages of D2 compilation. For example, while not core to D2, a hypothetical set of plugins can add a styled border, add your signature/credits, make everything look hand-drawn, then increase contrast for accessibility.

Completeness: I could not tell you any improvement to Vim's Go plugin if you asked me to name one [5]. It feels complete. However, there are plenty of plugins/extensions I've used which felt lacking, e.g. the syntax highlighting only identified some basic tokens and stopped there.

Extensibility: A hallmark of a good developer tool is when its modularity enables unplanned usage.

If you have any suggestions or feedback, we'd love to hear from you! Please open an issue on Github.

[0] Many other domains are also majority capturable by algorithms, like trees for HR diagrams. Other domains like biology, the majority of diagrams are custom-drawn.

[1] Some diagrams will always require manual labor. For example, if you want to have a translucent blueprint of an airplane and overlay shapes and lines on specific parts. Good GUI diagram-makers will always be necessary.

[2] MermaidJS seems to have implemented support for containers as well, but it's not widely released and their live editor still won't allow it.

[3] For now, this is closed-source. It's free to download and evaluate. To learn more, visit https://terrastruct.com/tala.

[4] If you still miss the hand-drawn aesthetic, D2 has just the thing: https://github.com/terrastruct/d2/pull/492

[5] Actually, gopls single-handedly brings my machine back to 2005 speeds with how much CPU it consumes. Not the fault of vim-go though!

---

## Seamless integration between D2 Studio and Confluence​

**URL:** https://d2lang.com/tour/confluence/

**Contents:**
- Atlassian Confluence app
- Seamless integration between D2 Studio and Confluence​

Your browser does not support the video tag.

This app is for D2 Studio and requires an account on D2 Studio.

Install Confluence app

---

## Globs apply backwards and forwards​

**URL:** https://d2lang.com/tour/globs/

**Contents:**
- Globs
- Globs apply backwards and forwards​
- Globs are case insensitive​
- Globs can appear multiple times​
- Glob connections​
- Scoped globs​
- Recursive globs​
- Filters​
  - Property filters​
  - Filters on array values​

The glob command, short for global, originates in the earliest versions of Bell Labs' Unix... to expand wildcard characters in unquoted arguments ...

https://en.wikipedia.org/wiki/Glob_(programming)

Globs are a powerful language feature to make global changes in one line.

In the following example, the instructions are as follows:

You can use globs to create connections.

Notice how self-connections were omitted. While not entirely consistent with what you may expect from globs, we feel it is more pragmatic for this to be the behavior.

You can also use globs to target modifying existing connections.

Notice that in the below example, globs only apply to the scope they are specified in.

** means target recursively.

Notice how machine B was not captured. Similar to the exception with * -> * omitting self-connections, recursive globs in connections also make an exception for practical diagramming: it only applies to non-container (AKA leaf) shapes.

Use & to filter what globs target. You may use any reserved keyword to filter on.

Aside from reserved keywords, there are special property filters for more specific targeting.

If the filtered attribute has an array value, the filter will match if it matches any element of the array.

Globs can also appear in the value of a filter. * by itself as a value for a filter means the key must be specified.

Adding multiple lines of filters counts as an AND.

Connections can be filtered by properties on their source and destination shapes.

Endpoint filters also work with IDs, e.g. &src: b.

Endpoint IDs are absolute. For example, a.c instead of just c, even if the glob is declared within a.

Use !& to inverse-filter what globs target.

You can nest globs, combining the features above.

Triple globs apply globally to the whole diagram. The difference between a double glob and a triple glob is that a triple glob will apply to nested layers (see the section on composition for more on layers), as well as persist across imports.

If you import a file, the globs declared inside it are usually not carried over. Triple globs are the exception -- since they are global, importing a file with triple glob will carry that glob as well.

One common use case of globs is to change the default styling of a theme.

---

## Nested syntax​

**URL:** https://d2lang.com/tour/containers/

**Contents:**
- Containers
- Nested syntax​
- Container labels​
  - 1. Shorthand container labels​
  - 2. Reserved keyword label​
- Example​
- Reference parent​

You can avoid repeating containers by creating nested maps.

There are two ways define container labels.

Sometimes you want to reference something outside of the container from within. The underscore (_) refers to parent.

---

## Rules​

**URL:** https://d2lang.com/tour/sequence-diagrams/

**Contents:**
- Sequence Diagrams
- Rules​
  - Scoping​
  - Ordering​
- Features​
  - Sequence diagrams are D2 objects​
  - Spans​
  - Groups​
  - Notes​
  - Self-messages​

Sequence diagrams are created by setting shape: sequence_diagram on an object.

Unlike other tools, there is no special syntax to learn for sequence diagrams. The rules are also almost exactly the same as everywhere else in D2, with two notable differences.

Children of sequence diagrams share the same scope throughout the sequence diagram.

Outside of a sequence diagram, there would be multiple instances of alice and bob, since they have different container scopes. But when nested under shape: sequence_diagram, they refer to the same alice and bob.

Elsewhere in D2, there is no notion of order. If you define a connection after another, there is no guarantee is will visually appear after. However, in sequence diagrams, order matters. The order in which you define everything is the order they will appear.

This includes actors. You don't have to explicitly define actors (except when they first appear in a group), but if you want to define a specific order, you should.

An actor in D2 is also known elsewhere as "participant".

Like every other object in D2, they can be contained, connected, relabeled, re-styled, and treated like any other object.

Spans convey a beginning and end to an interaction within a sequence diagram.

A span in D2 is also known elsewhere as a "lifespan", "activation box", and "activation bar".

You can specify a span by connecting a nested object on an actor.

Groups help you label a subset of the sequence diagram.

A group in D2 is also known elsewhere as a "fragment", "edge group", and "frame".

We saw an example of this in an earlier example when explaining scoping rules. More formally, a group is a container within a sequence_diagram shape which is not connected to anything but has connections or objects inside.

Due to the unique scoping rules in sequence diagrams, when you are within a group, the objects you reference in connections must exist at the top-level. Notice in the above example that alice and bob are explicitly declared before group declarations.

Notes are declared by defining a nested object on an actor with no connections going to it.

Self-referential messages can be declared from an actor to the themselves.

You can style shapes and connections like any other. Here we make some messages dashed and set the shape on an actor.

Lifeline edges (those lines going from top-down) inherit the actor's stroke and stroke-dash styles.

---

## Create​

**URL:** https://d2lang.com/tour/api/

**Contents:**
- D2 Oracle
- Create​
- Set​
- Delete​
- Rename​
- Move​
- ID Deltas​

D2 has an API built on top of its AST for programmatically creating diagrams in Go. This package is d2/d2oracle.

This API is exercised heavily by Terrastruct to implement bidirectional edits. We have comprehensive test coverage of these functions. If there's any confusion from the docs, there's almost certainly a test that answers your question. (We're also happy to help, just file a GitHub issue!)

For a blog post detailing an example usage (building a SQL table diagram), see https://terrastruct.com/blog/post/generate-diagrams-programmatically/.

All functions in d2oracle are pure: they do not mutate the original graph, they return a new one. If you are chaining calls, don't forget to use the resulting graph from the previous call.

Create a shape or connection.

Everything specified in the given key will be created. So for example, if you create a connection between 2 shapes that don't exist, they will be created in the same call. If you specify a nested object, it will create the parent containers if they do not exist.

If you call Create twice with the same shape ID, you will get an error. If you call it twice with the same edge ID, you will create another edge.

newKey is the ID of the object created. This doesn't always match the input key.

For shapes, there may be an ID collision. Create appends a counter in this case.

Connection IDs include the index.

If you have a multi-board diagram like so:

Set an attribute on a shape or connection.

The shape or connection that Set is modifying must exist.

If the attribute is already set, it is overwritten.

Connections are targeted with an index.

To unset an attribute, just pass nil.

If you do not pass an attribute and just give the ID of a shape or connection, it will set that object's primary value (usually label).

Delete a shape or connection.

If you specify a container with children, those children will be deleted too.

Rename the ID of a shape or connection.

Note that the ID != label. If you want to change the label, use Set.

Rename will rename all references of the given key.

Move a given shape or connection to a different container.

If you give two keys of the same scope (e.g. "a" to "b"), it's the same as Rename.

You can move things out of containers, into container, or across containers

For calls which can affect more than one ID, there is an API for getting a map of every single ID change. This can be hard to keep track of; for example, if you move a container with many descendants, the ID of all those descendants have changed, as well as all the connections that reference anything within the container.

When would you use this? If you are keeping state of D2 objects somewhere else other than the graph, e.g. in your own storage or writing back to somewhere, these calls should be used to keep track of all programmatic changes.

Each of these have the same input parameters as their counterparts, and return a string to string map of ID changes.

Given this input D2 script:

deltas, err := MoveIDDeltas(g, nil, "x", "y.x")

---

## Render of diagram.d2​

**URL:** https://d2lang.com/tour/imported-template/

**Contents:**
- Template
- Render of diagram.d2​

You make diagrams for external consulting clients. In order to appear professional, all diagrams must be contained within a template that your designer has created that is on-brand.

This use case will be made much more powerful when D2 finishes glob (*) support.

---
