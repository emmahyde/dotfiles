# D2 - Blog

**Pages:** 11

---

## Simple example​

**URL:** https://d2lang.com/blog/powerpoint/

**Contents:**
- Text to PowerPoint
- Simple example​
- Complex example​
- Limitations​

D2 is a diagramming language, and it's versatile unlike any other. For example, you can create full PowerPoint presentations with just text.

It's not D2's primary function, but rather a natural byproduct of a powerful language. D2 built features for grid diagrams and animations, and users built pixel art. And now, with Markdown and Powerpoint, D2 is the easiest way to programmatically create PowerPoint presentations.

Let's look at a simple example first, and then a complex one at the end.

The above is pure text. Let's look at an example with diagrams and images.

Be sure to go into Present mode to click on objects and navigate around.

The source code for this is a bit longer, and can be found here.

Note that the boxes aren't native PowerPoint boxes that you can resize, and the text isn't text you can edit. It's very much a "view-only" output. This is a v1 that's just been released. Perhaps this will change in the future and we can map things to its PowerPoint equivalent, especially if there's enough demand and usage.

---

## One model, multiple views​

**URL:** https://d2lang.com/blog/c4/

**Contents:**
- C4 Model
- One model, multiple views​
- Personal Banking Customer
- Internet Banking System
- E-mail System
- Mainframe Banking System
- Web Application
- Single-Page Application
- Mobile App
- API Application

The C4 Model is a diagramming framework. Over the years, we've had many practitioners request C4 features in D2. There's even a community-maintained exporter from the C4 creator's tool, Structurizr, to D2.

The C4 Model is a loose framework. Unlike UML, which says these symbols always and must mean certain things, the C4 model is a set of diagramming concepts. It's language and tool agnostic, and these powerful concepts have proven to provide software projects with clean, mature architecture diagrams.

With the latest 0.7 release of D2, we filled the gaps in the language to have first-class support of these concepts:

Whether you choose to use these new features specifically for C4 model diagrams is up to you. Much of this feature set was requested for other purposes. What's important are the good practices it enables, which can be applied broadly across all sorts of diagrams.

In this article, I'll demonstrate how you can make C4 diagrams in D2. If you'd like more detail on using a specific feature, you'll find dedicated sections in the docs.

Let's take a look at how the new suspend keyword can be used to slice and dice a model into a variety of views.

First we define a medium-sized diagram using the new C4 theme, c4-person shape, and markdown labels.

A customer of the bank, with personal bank accounts.

The internal Microsoft Exchange e-mail system.

Stores all of the core banking information about customers, accounts, transactions, etc.

[Container: Java and Spring MVC]

Delivers the static content and the Internet banking single page application.

[Container: JavaScript and Angular]

Provides all of the Internet banking functionality to customers via their web browser.

Provides a limited subset of the Internet banking functionality to customers via their mobile device.

[Container: Java and Spring MVC]

Provides Internet banking functionality via a JSON/HTTPS API.

[Container: Oracle Database Schema]

Stores user registration information, hashed authentication credentials, access logs, etc.

Let's say we want to create a view for the API team that only includes what's relevant for them. We'll use the same code as the above, but add 2 sections:

Use globs to target everything declared so far and suspend them. These will be removed unless "unsuspended" later on. Suspended objects and connections are effectively the models.

Now we use globs to declare which models we want to show up. We do this by "unsuspending" them.

The internal Microsoft Exchange e-mail system.

Stores all of the core banking information about customers, accounts, transactions, etc.

[Container: JavaScript and Angular]

Provides all of the Internet banking functionality to customers via their web browser.

Provides a limited subset of the Internet banking functionality to customers via their mobile device.

[Container: Java and Spring MVC]

Provides Internet banking functionality via a JSON/HTTPS API.

Let's make a high level overview with the same concepts. The only change here is how we unsuspend things.

And since there are connections between inner shapes of Internet Banking System to other components, we'll make some connections that capture the general dependency.

A customer of the bank, with personal bank accounts.

The internal Microsoft Exchange e-mail system.

Stores all of the core banking information about customers, accounts, transactions, etc.

Let's say your repository of models is large; maybe everyone in your cross-functional team is pushing their own models to this file.

To give an example of a small repository:

Allows customers to perform financial transactions via physical terminals.

Monitors transactions for suspicious activity using ML algorithms.

Tools for customer service representatives to assist clients.

Sends alerts and notifications to customers via multiple channels.

[Container: Python & Django]

Processes payments and interfaces with external payment networks.

[Container: Azure Cloud Storage]

Automated backup of critical banking data.

Administrative interface for system maintenance and user management.

Manages authentication, authorization, and security policies.

[Container: Python & Pandas]

Generates reports and analytics for internal stakeholders.

[Container: ELK Stack]

Centralized logging for auditing and debugging purposes.

Ensures banking activities comply with regulations.

[Container: Node.js & NLP]

AI-powered chat interface for customer support.

Know Your Customer identity verification process.

Handles loan applications and approval workflows.

Provides trading and investment capabilities to customers.

[Container: Java & Spring Boot]

Core functions for creating and managing customer accounts.

Allows customers to schedule and pay bills electronically.

High-performance engine for processing financial transactions.

[Container: Snowflake]

Enterprise data repository for analytics and business intelligence.

[Container: GraphQL & Node.js]

API gateway specifically optimized for mobile client applications.

To reuse these models for a specific domain, we can filter by their classes (tag in C4 vernacular). Assuming the models are in their own file, we can create something like a CustomerInterface.d2 file, which imports these models, suspends all, and unsuspends the ones that have the customer-facing class.

Allows customers to perform financial transactions via physical terminals.

Sends alerts and notifications to customers via multiple channels.

[Container: Node.js & NLP]

AI-powered chat interface for customer support.

Know Your Customer identity verification process.

Provides trading and investment capabilities to customers.

Allows customers to schedule and pay bills electronically.

[Container: GraphQL & Node.js]

API gateway specifically optimized for mobile client applications.

Now we can add some connections to create a diagram out of these pre-existing models.

Allows customers to perform financial transactions via physical terminals.

Sends alerts and notifications to customers via multiple channels.

[Container: Node.js & NLP]

AI-powered chat interface for customer support.

Know Your Customer identity verification process.

Provides trading and investment capabilities to customers.

Allows customers to schedule and pay bills electronically.

[Container: GraphQL & Node.js]

API gateway specifically optimized for mobile client applications.

To create a legend for this diagram, we declare it as a variable under d2-legend.

Think of d2-legend as a mini diagram of its own, but with a special layout where every shape and connection is deconstructed into a table. If something has opacity 0, it is excluded in the table (this way we can have legends that only show connections, for example).

Notice the legend in the bottom right corner.

Allows customers to perform financial transactions via physical terminals.

Sends alerts and notifications to customers via multiple channels.

[Container: Node.js & NLP]

AI-powered chat interface for customer support.

Know Your Customer identity verification process.

Provides trading and investment capabilities to customers.

Allows customers to schedule and pay bills electronically.

[Container: GraphQL & Node.js]

API gateway specifically optimized for mobile client applications.

Lastly, a core concept of C4 diagrams is this notion of zooming in and out of different levels of abstraction. The 4 in C4 stands for the 4 levels of abstractions that it recommends. Let's take a look at how that can be achieved. For this example, we'll define two diagrams of code that represent a zoomed in view of the components.

Example code diagram for ATM Banking System

Example code diagram for Notification System

Now let's link these up using the layers feature.

All that's needed is to declare the 2 code diagrams as layers and add the link property to whichever shape we want to be able to zoom into them.

We can export this to a PDF format. If you download it and click on notification or banking, it'll take you to those respective zoomed-in code views.

To recap, you'd split it out into those 4 files and use imports for modularity:

You can easily flesh this out further by having files for the styling, for higher levels of abstraction (e.g. for context diagrams).

---

## Dark-mode responsive diagrams

**URL:** https://d2lang.com/blog/tags/dark-mode/

**Contents:**
- One post tagged with "dark mode"
- Dark-mode responsive diagrams

I want to briefly highlight a cool new feature in D2, which is that you can set both a light theme and a dark theme for diagrams in D2.

How does this work? How can a diagram have two themes?

---

## Use cases​

**URL:** https://d2lang.com/blog/animation/

**Contents:**
- Text to (animated) diagrams
- Use cases​
  - Show change​
  - Show steps​
- Ergonomics will be better soon​

This is a single SVG file created purely through D2 text:

D2 source to reproduce this is here: here, rendered with these parameters.

Typically, when you're making a diagram primarily to show change in a single image, you put them side by side. And the user scans. Their eyes are darting back and forth, piecing together the deltas.

Instead, you can overlay and switch back and forth in place, making that process much easier and clarifying the differences.

Showing versions is a form of showing change. An example of this is conveyed in the first example above.

Take the viewer through a sequence of steps

Or a journey to build up to something.

D2 is not yet 1.0. Of the many things planned in the near term, better ergonomics for creating these are a priority. The source code for all of these diagrams can be found here. Some of these are currently verbose and repetitive. We've released early to get feedback from the community, but in-progress things like globs (being able to target objects with *) and classes will make creating these animations much easier than they currently are.

--animate-interval is available to use in D2 0.3.0 (install here), hope you can check it out and let us know what you think!

---

## 

**URL:** https://d2lang.com/blog/hand-drawn-diagrams/

**Contents:**
- Hand-drawn diagram aesthetic

Sketch mode started out as a "wouldn't it be cool" weekend feature, and has since turned into one of the things people love most about D2.

When you pass the sketch flag like so, you'll get a diagram that kind of looks hand-drawn.

Playground link to modify diagram

Most of the credit here goes to RoughJS for providing such an excellent library for converting normal SVG paths into imperfect ones, making the slight inaccuracies that our hand might when whiteboarding these types of diagrams in real life. Preet is an example of just a solo developer responsible for maintaining a small project that's behind-the-scenes for what is now a good chunk of a lot of diagrams you see on the web today! Please consider sponsoring him if you like this aesthetic.

For the most part, the implementation was as simple as using this library to convert paths, tune the parameters (e.g. we don't want paths to look as roughly drawn as shapes), and pick an appropriate font to match the aesthetic. Since D2 runs on Go and RoughJS is obviously a Javascript library, we embed a pure Go Javascript-runner as the bridge.

However, we did make one significant modification to this method: background fills.

RoughJS comes with many default fill patterns, but we thought they were all too jarring for diagramming. For example, this is a render on Excalidraw, another diagramming tool that leverages RoughJS.

While this does emulate a color-pencil type of fill, true to a hand-drawn aesthetic, it also makes the contents hard to read. We looked into options like putting a mask on the text so it dodges those lines, but even if it solves that problem, it brings a sharpness to the diagram that looks a bit intense, like we're aggressively coloring in something.

The solution that our designer came up with is to overlay a subtle texture of streaks that blends into the background. And to make it visible on all colors, the method of blending changes depending on how bright the background color is.

If you inspect the main diagram of this post, you can see it in effect with the various brightness of fills.

It even works with animated connections!

---

## Code documentation​

**URL:** https://d2lang.com/blog/ascii/

**Contents:**
- ASCII output
- Code documentation​
- Unicode and standard ASCII​
- Limitations​
- Try it yourself​

In the latest release of D2 (0.7.1), we introduce ASCII outputs.

Any output file with extension txt will use the ASCII renderer to write to it.

Here is an example of their rendering from the D2 Vim extension. The user opens a .d2 file and opens a preview window, which updates upon every save.

Perhaps the most useful place for ASCII diagrams is in the source code comments. Small simple diagrams next to functions or classes can serve to be much clearer than describing a flow.

Here again the Vim extension demonstrates a functionality to write some d2 code and replace the selection with the ASCII render.

The default character set of ASCII renders is unicode, which has nicer box-drawing characters. If you'd like true ASCII for maximum portability, you can specify this with the flag --ascii-mode=standard.

Note that the ASCII renderer should be considered in alpha stage. There will be many corner cases, areas of improvements, and outright bugs. If you enjoy using it, we'd appreciate you taking the time to file any issues you run into: https://github.com/terrastruct/d2/issues.

The ASCII renderer is a downscale of the layout determined by the ELK layout engine with some post-processing to further compact it.

This is live now in the D2 Playground. Try opening the below code block (click top right of it).

---

## Text to PowerPoint

**URL:** https://d2lang.com/blog/tags/show-and-tell/

**Contents:**
- 3 posts tagged with "show-and-tell"
- Text to PowerPoint
- Hand-drawn diagram aesthetic
- Dark-mode responsive diagrams

D2 is a diagramming language, and it's versatile unlike any other. For example, you can create full PowerPoint presentations with just text.

It's not D2's primary function, but rather a natural byproduct of a powerful language. D2 built features for grid diagrams and animations, and users built pixel art. And now, with Markdown and Powerpoint, D2 is the easiest way to programmatically create PowerPoint presentations.

Sketch mode started out as a "wouldn't it be cool" weekend feature, and has since turned into one of the things people love most about D2.

When you pass the sketch flag like so, you'll get a diagram that kind of looks hand-drawn.

I want to briefly highlight a cool new feature in D2, which is that you can set both a light theme and a dark theme for diagrams in D2.

How does this work? How can a diagram have two themes?

---

## ASCII output

**URL:** https://d2lang.com/blog/

**Contents:**
- ASCII output
- C4 Model
- Text to PowerPoint
- Text to (animated) diagrams
- Hand-drawn diagram aesthetic
- Dark-mode responsive diagrams

In the latest release of D2 (0.7.1), we introduce ASCII outputs.

Any output file with extension txt will use the ASCII renderer to write to it.

The C4 Model is a diagramming framework. Over the years, we've had many practitioners request C4 features in D2. There's even a community-maintained exporter from the C4 creator's tool, Structurizr, to D2.

The C4 Model is a loose framework. Unlike UML, which says these symbols always and must mean certain things, the C4 model is a set of diagramming concepts. It's language and tool agnostic, and these powerful concepts have proven to provide software projects with clean, mature architecture diagrams.

With the latest 0.7 release of D2, we filled the gaps in the language to have first-class support of these concepts:

D2 is a diagramming language, and it's versatile unlike any other. For example, you can create full PowerPoint presentations with just text.

It's not D2's primary function, but rather a natural byproduct of a powerful language. D2 built features for grid diagrams and animations, and users built pixel art. And now, with Markdown and Powerpoint, D2 is the easiest way to programmatically create PowerPoint presentations.

This is a single SVG file created purely through D2 text:

D2 source to reproduce this is here: here, rendered with these parameters.

Sketch mode started out as a "wouldn't it be cool" weekend feature, and has since turned into one of the things people love most about D2.

When you pass the sketch flag like so, you'll get a diagram that kind of looks hand-drawn.

I want to briefly highlight a cool new feature in D2, which is that you can set both a light theme and a dark theme for diagrams in D2.

How does this work? How can a diagram have two themes?

---

## Text to PowerPoint

**URL:** https://d2lang.com/blog/tags/powerpoint/

**Contents:**
- One post tagged with "powerpoint"
- Text to PowerPoint

D2 is a diagramming language, and it's versatile unlike any other. For example, you can create full PowerPoint presentations with just text.

It's not D2's primary function, but rather a natural byproduct of a powerful language. D2 built features for grid diagrams and animations, and users built pixel art. And now, with Markdown and Powerpoint, D2 is the easiest way to programmatically create PowerPoint presentations.

---

## 

**URL:** https://d2lang.com/blog/dark-mode/

**Contents:**
- Dark-mode responsive diagrams

I want to briefly highlight a cool new feature in D2, which is that you can set both a light theme and a dark theme for diagrams in D2.

How does this work? How can a diagram have two themes?

Try opening up your system preferences and toggling between light and dark mode.

Playground link to modify diagram

Note: playground does not have support to set a dark theme yet

What you should have seen is the above diagram adapting to your preference. If you didn't want to follow along, here's two PNGs of what it would've transitioned between:

This means that if your website already supports a responsive experience for visitors that prefer light mode and dark mode, it takes zero extra work to include a D2 diagram that'll adapt to light preferences. The alternative method used across the web currently is to include two diagrams -- and toggle which one gets shown with media queries.

This is currently a new feature, and we are working on adding more themes and considering including it by default.

How does this work? The diagram actually is a high level overview of it. All the shapes and connections are color coded, which takes into account their depth, shape type, and a few other factors. The themes then provide a color for that color code in CSS. Since classes are secondary to attributes and styles, any explicitly set styles are not overwritten. The dark mode theme simply applies a different set of colors to the color codes with a media query.

Shoutout to first-time contributor https://github.com/vfosnar, who came up with the idea and juggled commits in between high school exams to implement this <3.

---

## Hand-drawn diagram aesthetic

**URL:** https://d2lang.com/blog/tags/hand-drawn/

**Contents:**
- One post tagged with "hand-drawn"
- Hand-drawn diagram aesthetic

Sketch mode started out as a "wouldn't it be cool" weekend feature, and has since turned into one of the things people love most about D2.

When you pass the sketch flag like so, you'll get a diagram that kind of looks hand-drawn.

---
