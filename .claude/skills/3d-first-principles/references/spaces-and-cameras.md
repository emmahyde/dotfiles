# Spaces and Cameras

Depth for P-ORIGIN, P-FLATTEN, and P-DIVIDE. Teach from the top; each section assumes the one before it.

## The transform chain

A point travels through four spaces on its way to the screen. Each step is one instruction card (P-RECIPE) applied to the point.

1. **Local space.** The point as the modeller made it, measured from the model's own centre.
2. **World space.** Where the model sits in the shared world. The card here is the object's position, rotation, and scale.
3. **View space.** The same point, measured from the camera. The card here is the camera's position and rotation, applied backwards. Moving the camera left is the same as moving the whole world right.
4. **Clip and screen space.** The flattening rule turns 3D into 2D, then the result is scaled to pixels.

The chain is why "the numbers look right but it renders wrong" is so common. Every step is correct arithmetic on the wrong input.

### Checking which space a number is in

Ask what the number would read if the object sat exactly at the world origin and the camera sat exactly at the world origin. If the number changes when you move the camera, it is a view-space or screen-space number. If it changes when you move the parent object, it is a local number.

## Perspective in detail

A perspective camera divides by depth. The strength of that division is set by the **field of view**, or FOV: the angle of the cone the camera sees.

- A narrow FOV, around 30 degrees, is a telephoto lens. Distant things stay large. Depth looks compressed and flat.
- A wide FOV, 90 degrees or more, is a wide-angle lens. Things rush at you. Depth looks exaggerated.

### How to compute apparent size

This is the calculation that settles most "how big will it look" arguments.

```
frame height at distance D  =  2 * D * tan(FOV / 2)
fraction of screen filled   =  object height / frame height
```

Worked example. A camera has a 100 degree vertical FOV. An object 1100 units away is 600 units tall.

```
frame height = 2 * 1100 * tan(50 deg) = 2 * 1100 * 1.19 = 2622 units
fraction     = 600 / 2622 = 0.23
```

The object fills 23 percent of the screen height. On a 900 pixel tall view, that is 206 pixels.

### Angular size is the honest measure

Screen size depends on FOV and resolution. **Angular size** does not. It is the angle an object subtends at the eye, and it is the number to reason with.

```
angular size (radians) ~= object size / distance     (for small angles)
```

The Moon is about 0.5 degrees across. So is the Sun. That is why an eclipse works.

## Orthographic in detail

An orthographic camera throws depth away. It has no FOV, because it has no cone. It has a **size**: the height of the world region it captures, in world units.

- Ortho size 20 means the camera sees 20 world units from top to bottom, always, at any distance.
- To zoom, you change the size. Moving the camera closer does nothing at all.

That last point surprises people. Dollying an orthographic camera changes nothing except what gets clipped.

### What orthographic buys you

Its job is to make size mean something other than distance. Once depth cannot change apparent size, size can carry real information: a big thing on screen is a big thing in the world, full stop.

That is the job. The mechanism it forces is throwing away depth. The obvious alternative, a perspective camera pulled far back, fails at that job: it only makes the division weaker, never absent, so size still leaks distance information and the reader still feels pulled toward things.

Blueprints, isometric strategy games, and top-down maps all use orthographic for this reason.

## Clip planes and the frustum

A camera does not see everything. It sees a box-shaped region of space.

- **Near clip plane.** Nothing closer than this is drawn. It cannot be zero.
- **Far clip plane.** Nothing further than this is drawn.

For a perspective camera, that region is a pyramid with the tip cut off. The name for that shape is a **frustum**.

```
        far plane
     +---------------+
      \             /
       \           /       <- everything inside is drawn
        \         /
         +-------+   near plane
          \     /
           \   /
            \ /
             X  camera
```

For an orthographic camera, the sides are parallel, so the region is a plain box.

### Why the near plane cannot be zero

Depth is stored with limited precision. That precision is spread between near and far, and it is spread very unevenly: most of it sits near the camera. Setting the near plane to a tiny number spends nearly all your precision on the first few units and leaves almost none for everything beyond.

The result is **z-fighting**: two surfaces at nearly the same depth flicker against each other, because the depth values are too coarse to tell them apart.

The fix is almost always to push the near plane out, not to pull the far plane in. The ratio far/near is what matters.

### "My object disappeared"

Work down this list. It is nearly always one of these.

- It is behind the near plane or beyond the far plane.
- It is outside the camera's cone, off to one side.
- Its layer is excluded by the camera's **culling mask**.
- Its faces point away from the camera and back faces are not drawn.
- It is drawn, but behind something else.
- Its scale is zero, or so small it covers less than one pixel.

## Screen space and pixels

Screen space is measured in pixels from a corner of the screen. Two conversions matter.

- **Aspect ratio** is width divided by height. A camera's FOV is usually the *vertical* angle, and the horizontal angle is derived from the aspect. Change the window shape and you change how much you see sideways, not up and down.
- **Pixels per unit**, in 2D games, sets how many screen pixels one world unit covers. Get it wrong and sprite art shimmers, because texture pixels no longer land on screen pixels one to one.

## Isometric and 2.5D

An isometric game is usually not 2D at all. It is 3D geometry viewed through an orthographic camera locked to a fixed angle. The classic angle turns the world cube so you see three faces equally.

```
rotation ~= 35.264 degrees down, 45 degrees around
```

The 35.264 figure is `atan(1 / sqrt(2))`, the angle at which a cube's three visible faces project to equal areas.

Because the camera is orthographic, nothing grows as the player moves. The world slides underneath instead. That sliding, not depth, is what sells the flat register.

**2.5D** means 3D models presented in a way that reads as flat: fixed camera angle, movement locked to a plane, no depth cues that let the player judge distance by size.

## Parallax

When you move sideways, near things sweep past faster than far things. Drive a car: the fence whips by, the mountains barely shift.

The rate is distance divided by range:

```
apparent sweep rate  =  your sideways speed / distance to the thing
```

This is why a mountain feels static and a roadside post feels violent. It is also the failure mode behind "it zoomed past me". As range goes to zero, the sweep rate goes to infinity. Anything you approach directly will, at close range, swing across your view faster than any speed limit can prevent, because the divisor is what is shrinking.

Two ways to avoid it:

- Never let the range get small. Stop the approach before the divisor gets dangerous.
- Do not divide by range at all. Fix each object's direction and slide the whole backdrop by a bounded amount instead. Nothing can whip, because nothing is divided.

### Parallax layers in 2D

A 2D game fakes the same effect with layers. Each layer scrolls at a fraction of the camera's speed. Background 0.2, midground 0.6, foreground 1.0. There is no depth anywhere, only three multipliers.

## Cameras that work together

- **Camera stacking.** Several cameras draw into one image in order. A base camera draws the world; overlay cameras draw on top without clearing. Useful when parts of the scene need different projections, such as a perspective starfield behind an orthographic play field.
- **Culling mask.** Each object sits on a layer. Each camera lists the layers it draws. This is how one camera sees the world and another sees only the interface.
- **Render order.** Later cameras draw over earlier ones. Within one camera, depth decides, unless depth testing is off.

## Rotation, and why quaternions exist

Storing a rotation as three angles, one per axis, is called **Euler angles**. It is readable and it has a defect.

Apply the three turns in order and two of the axes can line up, so one degree of freedom vanishes. Aim straight up and "turn left" and "roll left" become the same motion. That is **gimbal lock**.

A **quaternion** stores rotation as four numbers instead of three angles. It cannot lock, and it interpolates smoothly between two orientations. It is not readable by eye. Use Euler angles to type a value in, quaternions to compute with.

## A vocabulary check

If a reader can finish these sentences, the section landed.

- A space is defined by **what you measure from**.
- Perspective divides by **depth**; orthographic **does not divide**.
- FOV is an **angle**; ortho size is a **distance**.
- The visible region of a perspective camera is a **frustum**.
- Z-fighting comes from **too little depth precision**, usually from a near plane set too close.
- Apparent sweep rate is **speed divided by range**.
