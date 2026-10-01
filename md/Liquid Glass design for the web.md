# Safari Can Frost Liquid Glass but Not Bend It

Liquid Glass is Apple's translucent "digital meta-material" for system chrome. Apple announced it at WWDC on 9 June 2025 and shipped it on 15 September 2025 in iOS 26, iPadOS 26, macOS Tahoe 26, watchOS 26 and tvOS 26. visionOS inspired it but keeps its own window glass. Older frosted materials scatter light; Liquid Glass bends it. This lensing is its defining trait. On top of it Apple adds moving specular highlights, an adaptive shadow and tint, gel-like motion, and morphing between controls, all built from capsule and concentric shapes. Apple's usage rules are strict and have stayed stable. Glass belongs only to a floating navigation layer (bars, sidebars, menus, popovers and a few controls). It never goes on content and never on other glass, and colour is reserved for one or two primary actions.

Legibility was the weak point. Infinum measured contrast as low as 1.5:1, and NN/g called parts of iOS 26 an "illegible mess." Apple backed off in steps:

- Frostier betas in July 2025.
- A Clear/Tinted toggle in iOS 26.1 (3 November 2025).
- A Reduce Bright Effects toggle in iOS 26.4.
- In iOS 27 (14 September 2026): a clear-to-tinted slider, lower default transparency, darker edges and brighter highlights.

All of this sits on top of the Reduce Transparency, Increase Contrast and Reduce Motion modifiers the material honoured from day one.

On the web, Safari cannot render the signature effect. Refraction through `backdrop-filter: url(#svg)` works only in Chromium. Safari parses the rule and then paints nothing. Safari does render frost well: `-webkit-backdrop-filter` with a saturation boost, a tint layer, inset-shadow rims, and a pseudo-element sheen. Spring motion is available through `linear()` easing and View Transitions. Safari cannot detect the user's Reduce Transparency setting, so a userscript needs its own solid mode, also keyed to `prefers-contrast: more`. For ManageBac this means:

- Floating capsule clusters on the top bar.
- A tab-switcher thumb that is a plain fill, not glass.
- A high-opacity, inset timetable dock whose lesson cells stay solid.
- Menus that grow out of the button that opens them.
- A single tinted primary button.

## Apple built a light-bending layer that floats above content

Apple announced Liquid Glass on **9 June 2025** and shipped it on **15 September 2025** ([Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/); [MacRumors](https://www.macrumors.com/2025/09/15/apple-releases-ios-26/)). The Newsroom describes a material that "reflects and refracts its surroundings" and whose colour "intelligently adapts between light and dark environments." It covers everything from switches and sliders up to tab bars and sidebars. Controls are drawn "concentric with the rounded corners of modern hardware" ([Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)). The "Meet Liquid Glass" session calls it "a new digital meta-material that dynamically bends and shapes light." It traces the lineage through Aqua, iOS 7's real-time blur, iPhone X's fluid gestures, Dynamic Island and visionOS ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)).

visionOS is the inspiration, not an adopter. Craig Federighi named it "the most obvious inspiration" ([Wikipedia](https://en.wikipedia.org/wiki/Liquid_Glass)). But visionOS keeps its own unmodifiable window "glass," and it is missing from the availability list of SwiftUI's `Glass` API ([HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials); [Apple Developer: Glass](https://developer.apple.com/documentation/swiftui/glass)). MacRumors calls Liquid Glass the first major iOS redesign since iOS 7 ([MacRumors](https://www.macrumors.com/roundup/ios-26/)).

For anyone copying the design, the functional framing matters more than the look. The HIG says Liquid Glass "forms a distinct functional layer for controls and navigation elements — like tab bars and sidebars — that floats above the content layer." It lets content "scroll and peek through from beneath" ([HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)). Apple presents the shine as a way to build **a two-layer hierarchy**: chrome floats and content scrolls underneath. A web version that gets the hierarchy right and the optics approximately right will feel more like Liquid Glass than one with perfect refraction on the wrong elements.

### Lensing is layered on top of blur, not substituted for it

Apple's core claim is about how light behaves. Earlier materials "scattered light," while the new ones "dynamically bend, shape, and concentrate light in real time." **Lensing** is "the primary way Liquid Glass visually defines itself" ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)). Blur did not disappear, though. Apple's developer docs say the material "blurs content behind it, reflects color and light of surrounding content." The HIG says the regular variant "blurs and adjusts the luminosity of background content" ([Apple: Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views); [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)). Lensing sits on top of a frost. That distinction decides what Safari can reproduce.

Session 219 describes a stack of layers, each of which "continuously adapts based on what's behind it" ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)):

- **Specular highlights.** Virtual light sources produce highlights that "respond to geometry." The lights travel around the silhouette during interactions such as unlocking, and sometimes follow device motion.
- **Adaptive shadow.** It "increases the opacity of its shadow when it is over text" and lightens over flat light backgrounds.
- **Tint and dynamic range.** These shift "to always ensure buttons remain legible, while letting as much of the content through as possible."
- **Light spill.** On large elements such as sidebars, light from nearby colourful content "can subtly spill onto its surface."

Glass samples "content from an area larger than itself," and "glass can not sample other glass." This is why Apple makes neighbouring glass share a container ([WWDC25 session 323](https://developer.apple.com/videos/play/wwdc2025/323/)).

Size changes the material's behaviour:

- **Small elements** such as navigation and tab bars "flip from light to dark based on the background." The symbols on them flip too.
- **Large elements** such as menus and sidebars adapt but never flip, because "their surface area is too big and transitions like these would be distracting" ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)).
- **Growing glass**, such as a toolbar button opening into a menu, simulates "a thicker, more substantial material" with "deeper, richer shadows, … more pronounced lensing and refraction effects, and a softer scattering of light" ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)).

The HIG adds that glass "appears more opaque in larger elements like sidebars to preserve legibility" ([HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)).

Apple publishes almost no numbers. **The single explicit value is a 35% dark dimming layer** beneath the Clear variant when the content below is bright ([HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)). Every other figure in circulation is reverse-engineered. kube.io's optics analysis models refraction as concentrated in a curved bevel at the rim with an undistorted centre. It uses a squircle surface profile, a refractive index of about 1.5, and a rim highlight whose intensity depends on the angle to a fixed light ([kube.io](https://kube.io/blog/liquid-glass-css-svg/)). These are plausible estimates, not specifications.

There are two variants, and they "should never be mixed":

- **Regular** "provides legibility regardless of context" and works at any size.
- **Clear** "does not have adaptive behaviors" and is "permanently more transparent." It needs a dimming layer. Apple allows it only when all three of these hold: the element sits over media-rich content, the content can tolerate dimming, and the foreground is "bold and bright" ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)).

"Tinted" has three unrelated meanings ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/); [9to5Mac](https://9to5mac.com/2025/10/20/ios-26-1-beta-4-adds-new-setting-to-tone-down-liquid-glass-transparency/); [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)):

- A developer tint, `Glass.tint(_:)`, which "generates a range of tones that are mapped to content brightness underneath." It is reserved for primary actions.
- The user-level Tinted appearance added in iOS 26.1.
- The tinted app-icon style.

### Motion is designed as part of the material

Apple says "both the visuals AND motion of Liquid Glass were designed as one" ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)).

- **Appearing and disappearing.** Glass "materialize[s] in and out by gradually modulating the light bending and lensing" instead of fading.
- **Touch.** The material "illuminates from within." The glow starts "right under your fingertips" and spreads across the element and onto nearby glass, with "gel-like flexibility." SwiftUI's `.interactive()` packages this as "scaling, bouncing, and shimmering" ([WWDC25 session 323](https://developer.apple.com/videos/play/wwdc2025/323/)).
- **Lift.** Controls can lift into glass only while in use. Slider and toggle knobs become glass during a drag, so the lens shows the value underneath, and then return to a quiet resting state ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/); [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)).
- **Morphing.** Transitions keep "a singular floating plane." Menus pop open as a bubble from the tapped button, action sheets spring "from the action itself," and sheets zoom out of the toolbar button that presented them ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/); [WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/); [WWDC25 session 323](https://developer.apple.com/videos/play/wwdc2025/323/)).
- **Merging.** Inside a `GlassEffectContainer`, shapes blend once their nearest edges come within the container's spacing ([Apple: Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views)).
- **Tab bars** shrink when you scroll down and re-expand when you scroll back up ([WWDC25 session 323](https://developer.apple.com/videos/play/wwdc2025/323/)).
- **Input type.** Apple tones motion down for pointers. Glass responds "with greater emphasis" to touch and with "a more subdued effect" on a trackpad ([HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)). That makes macOS, not iOS, the better motion reference for a desktop website.

### Concentric capsules and scroll edge effects fix the geometry

Shapes nest around a shared centre that traces back to the corner radius of the hardware. Apple defines three shape types ([WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/)):

- **Fixed**: a constant radius.
- **Capsule**: radius equal to half the height.
- **Concentric**: the parent's radius minus the padding. A fallback radius applies when the component stands alone.

On iPhone, controls near the screen edge become capsules with extra margin. On iPad and Mac they use a concentric shape that follows the window edge (same source). On macOS, mini to medium controls stay rounded rectangles for density, while large controls and the new X-Large size become capsules. Bordered buttons and the default `glassEffect` shape are capsules ([WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/); [WWDC25 session 323](https://developer.apple.com/videos/play/wwdc2025/323/)). Apple wants hierarchy expressed "through layout and grouping" instead of decoration, and tells developers to remove custom bar backgrounds and borders ([WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/)).

Where content scrolls under floating glass, a **scroll edge effect** separates the two. It is "a subtle blur and fade" that dissolves content into the background, and over dark content it switches to "a subtle dimming instead" ([WWDC25 session 323](https://developer.apple.com/videos/play/wwdc2025/323/); [WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)). In 2025, Soft was the default. Hard, "a stronger, more opaque boundary," was "mostly used on macOS" for dense interfaces and pinned headers. Apple insists the effects "are not decorative," should only be used where floating UI exists, and should never be stacked ([WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/)). **In June 2026 the HIG switched to "Prefer the automatic scroll edge effect style."** That style becomes more opaque for toolbars with many controls, text outside glass controls, and pinned table headers ([HIG: Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views)).

## Apple confines glass to navigation and rations its colour

The most important rule leaves no room for interpretation: "**Don't use Liquid Glass in the content layer**." Glass there produces "unnecessary complexity and a confusing visual hierarchy," so content such as app backgrounds should use standard materials instead ([HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)). Session 219's example is a table view, which as glass "would make it compete with other elements and muddy the hierarchy" ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)). The only exception is a content-layer control with "a transient interactive element like sliders and toggles." It turns into glass only while someone is using it ([HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)).

Even within the navigation layer Apple asks for restraint: "Use Liquid Glass effects sparingly… Limit these effects to the most important functional elements." Its AppKit guidance keeps non-interactive toolbar items, such as titles and status indicators, off glass entirely ([HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials); [WWDC25 session 310](https://developer.apple.com/videos/play/wwdc2025/310/)).

The second rule is "Always avoid glass on glass." Elements placed on glass should use "fills, transparency, and vibrancy… to make them feel like a thin overlay that is part of the material" ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)). Part of the reason is technical: glass cannot sample glass, so neighbouring glass in separate containers renders inconsistently ([WWDC25 session 323](https://developer.apple.com/videos/play/wwdc2025/323/); [WWDC25 session 310](https://developer.apple.com/videos/play/wwdc2025/310/)). Custom controls should take the material directly, "not its inner views" ([WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/)). The line between allowed and forbidden matters here:

- **Allowed:** a menu popping out of a toolbar button. It is a separate floating layer that morphs from its source.
- **Forbidden:** a glass button sitting inside a glass sidebar. That is glass on glass.

Colour is rationed:

- "By default, Liquid Glass has no inherent color." Tint is reserved for "elements that truly benefit from emphasis, such as status indicators or primary actions."
- To emphasise a primary action, apply colour "to the background rather than to symbols or text," and "refrain from adding color to the background of multiple controls" ([HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)).
- Buttons are capped too: "Keep the number of prominent buttons to one or two per view."
- Avoid a custom button with a white fill and black label, because the system reserves that look for the toggled state ([HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)).
- Over colourful content, toolbars and tab bars should be monochrome. Brand colour belongs in the content layer ([HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color); [WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)).

Grouping replaces decoration. Bar items are grouped "by function and frequency," with "a maximum of three" groups, and text-labelled actions are kept apart from symbol actions ([WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/); [HIG: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)). AppKit automatically puts plain toolbar buttons on one shared piece of glass, and gives segmented controls, pop-up buttons and search their own ([WWDC25 session 310](https://developer.apple.com/videos/play/wwdc2025/310/)).

On macOS, the closest analogue to a desktop website ([WWDC25 session 310](https://developer.apple.com/videos/play/wwdc2025/310/); [WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/)):

- The whole toolbar "appears to float above the content."
- Sidebars are "a pane of glass that floats above the window's content," with scroll views extending beneath them.
- Inspectors use "edge-to-edge glass."
- Window corners grow to "wrap concentrically around the glass toolbar elements."
- Menus gained a single column of leading icons.

For modals, Apple separates interruptions from parallel work: "When a task interrupts the main flow, pair Liquid Glass with a dimming layer" ([WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/)). These placement rules have barely changed since June 2025. What has changed, repeatedly, is how see-through the glass is.

## Sixteen months of complaints pushed Apple toward opacity

The criticism focused on one failure: small text on or under translucent, refracting glass over busy content.

- **Infinum's** accessibility team measured contrast "as low as 1.5:1" in the June 2025 beta, against WCAG's 4.5:1 minimum. It did not name the screens or describe its method ([Infinum](https://infinum.com/blog/apples-ios-26-liquid-glass-sleek-shiny-and-questionably-accessible/)).
- **NN/g's** Raluca Budiu wrote on 10 October 2025 that in Mail "text on top of text creates an illegible mess" and that "motion for motion's sake is not usability." She said crowded tab bars abandon the old "0.4cm between targets (and 1cm × 1cm tap areas)" guidance, and that controls which appear and vanish show Apple "prioritizing spectacle over usability" ([NN/g](https://www.nngroup.com/articles/liquid-glass/)).
- **TidBITS** found that refraction in Notification Center visibly distorts the text beneath it ([TidBITS](https://tidbits.com/2025/10/09/how-to-turn-liquid-glass-into-a-solid-interface/)).
- **AppleVis's** 2025 report card, published in March 2026, found the redesign "had a significant negative impact" on low-vision users ([AppleWorld.Today](https://appleworld.today/2026/03/new-report-says-apples-liquid-user-interface-has-a-negative-affect-on-users-who-are-blind-or-have-low-vision/)).

Battery complaints are real but poorly evidenced. The most-cited test showed 13% versus 1% drain on two iPhones, but the two runs were months apart under uncontrolled conditions ([BGR](https://www.bgr.com/1975304/ios-26-vs-ios-18-battery-life-test-liquid-glass/)).

Apple responded in stages, and every step added opacity or choice rather than removing glass:

| Date | Release | What changed |
|---|---|---|
| 7 Jul 2025 | iOS 26 beta 3 | Bars, buttons and tabs turn frosted; notifications get darker backgrounds ([TechCrunch](https://techcrunch.com/2025/07/07/ios-26-beta-3-dials-back-liquid-glass/)) |
| 22 Jul 2025 | iOS 26 beta 4 | Partly reverses beta 3; Lock Screen darkens behind notifications as you scroll ([MacRumors](https://www.macrumors.com/2025/07/22/apple-liquid-glass-ios-26-beta-4/)) |
| 9 Sep 2025 | HIG update | Regular vs Clear guidance and the 35% dimming layer ([HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)) |
| 3 Nov 2025 | 26.1 | Clear/Tinted choice under Settings › Display & Brightness › Liquid Glass (Mac: System Settings › Appearance) ([9to5Mac](https://9to5mac.com/2025/10/20/ios-26-1-beta-4-adds-new-setting-to-tone-down-liquid-glass-transparency/); [MacRumors](https://www.macrumors.com/2025/11/03/apple-releases-ios-26-1/)) |
| Dec 2025 | 26.2 | Glass opacity slider and a Solid option for the Lock Screen clock ([TechCrunch](https://techcrunch.com/2025/12/12/with-ios-26-2-apple-lets-you-roll-back-liquid-glass-again-this-time-on-the-lock-screen/); [9to5Mac](https://9to5mac.com/2025/12/15/ios-26-2-expands-liquid-glass-in-three-ways-heres-whats-new/)) |
| Spring 2026 | 26.4 | "Reduce Bright Effects" dims the flash on touched glass controls ([9to5Mac](https://9to5mac.com/2026/04/10/ios-26-4-adds-setting-to-let-you-change-new-liquid-glass-effect/)) |
| 8 Jun 2026 | WWDC26 / HIG | iOS 27 changes announced; HIG now prefers the automatic scroll edge style ([MacRumors](https://www.macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27/); [HIG: Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views)) |
| 14 Sep 2026 | iOS 27 | Clear-to-tinted slider under Settings › Appearance › Liquid Glass; lower default transparency, more diffusion, darkened edges, brighter highlights, a uniform top toolbar when content scrolls under floating bars ([MacRumors](https://www.macrumors.com/how-to/ios-27-tone-down-liquid-glass-transparency/); [MacRumors](https://www.macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27/); [MacRumors](https://www.macrumors.com/2026/09/13/ios-27-release-date-new-features/)) |

Since day one, three system settings have modified the material automatically ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)):

- **Reduce Transparency** "makes Liquid Glass frostier and obscures more of the content behind it."
- **Increase Contrast** "makes elements predominantly black or white and highlights them with a contrasting border."
- **Reduce Motion** "decreases the intensity of some effects and disables any elastic properties."

TidBITS documented what they do in practice ([TidBITS](https://tidbits.com/2025/10/09/how-to-turn-liquid-glass-into-a-solid-interface/)):

- Reduce Transparency gives iOS notifications a solid background and makes the macOS menu bar opaque.
- On macOS, Increase Contrast adds solid outlines and **also switches on Reduce Transparency**.
- Reduce Motion is the only setting that removes the text-distorting refraction in Notification Center.

The 26.1 Tinted option, which "increases opacity and adds more contrast," is a display preference outside the Accessibility menu. It only takes effect while Reduce Transparency is off ([9to5Mac](https://9to5mac.com/2025/10/20/ios-26-1-beta-4-adds-new-setting-to-tone-down-liquid-glass-transparency/); [MacRumors](https://www.macrumors.com/how-to/ios-26-1-reduce-liquid-glass-effects/)). Putting it there answered critics such as Access Advisors, who complained that the transparency controls were buried in Accessibility ([Access Advisors](https://accessadvisors.nz/blog/liquid-glass)).

In iOS 27 that toggle became a slider. The left end gives "a clearer, more transparent effect," the right end adds "tint and opacity," and Apple's default sits at the midpoint ([MacRumors](https://www.macrumors.com/how-to/ios-27-tone-down-liquid-glass-transparency/); [9to5Mac](https://9to5mac.com/2026/06/15/ios-27-adds-new-liquid-glass-slider-on-iphone-heres-what-it-lets-you-do/)). One caveat: the iOS 27 rendering changes are documented through press coverage of Apple's keynote, not an Apple document.

Two patterns stand out. First, the surfaces people actually *read*, notifications and Control Center, went opaque first, while navigation chrome kept more transparency. Second, Apple ended with a four-step ladder: Clear, then Tinted (or a slider position), then Reduce Transparency, then Increase Contrast. Each step trades glass for legibility.

WCAG makes no allowance for translucency:

- **Text** needs **4.5:1**, or **3:1** for large text (at least about 24px regular or 18.66px bold).
- W3C lists "using background images that do not provide sufficient contrast with foreground text" as a failure. Glass must therefore pass against the *worst* backdrop that can scroll beneath it, not the average.
- A narrow outline counts as part of a letter, while a wide halo counts as background ([W3C: Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- **Icons and control edges** fall under SC 1.4.11's 3:1 non-text threshold (same source).

Apple's own Increase Contrast fix, a visible border, is also the WCAG-friendly one.

## Safari renders the frost but not the lens

These findings are framed against Safari 26.x on macOS 26. Safari 27 feature changes were not researched, although caniuse data through Safari 27.2 is cited where relevant. The table below shows how much of each trait Safari can reproduce.

| Apple trait | Safari-feasible approximation | Fidelity |
|---|---|---|
| Blur and luminosity adjustment | `-webkit-backdrop-filter: blur() saturate()` over a tint layer | High |
| Lensing and refraction | No live refraction; suggest it with a bright inner rim, a darker outer edge and an extended backdrop at the border | Low |
| Specular highlights | Inset shadows, brighter top border, `::after` sheen with `mix-blend-mode: screen` | Medium |
| Adaptive tint and light/dark flip | CSS cannot sample backdrop luminance; tune for the worst case and follow `prefers-color-scheme` | Low |
| Thickness grows with size | Deeper shadow and higher tint alpha on menus and the dock | Medium |
| Materialise, lift, touch glow | `transform`/`opacity` springs via `linear()`, press scale, pointer-positioned gradient | Medium |
| Morph from source | View Transitions (Safari 18+) or `transform-origin` at the trigger | Medium |
| Merging shapes (`GlassEffectContainer`) | Gooey metaball merging is impractical; group pieces on one shared capsule instead | Low |
| Concentric and capsule shapes | `border-radius: 9999px`; inner radius = max(outer − padding, fallback) | High |
| Scroll edge effect | Masked backdrop strip shown only when content is scrolled beneath | High |

### `-webkit-backdrop-filter` is the one native glass primitive Safari paints

Backdrop blur plus saturation over a low-alpha tint is the only native glass that renders in Safari. It reproduces the frost and vibrancy but none of the refraction. Safari has supported it since version 9 ([caniuse](https://caniuse.com/css-backdrop-filter)).

Whether the **unprefixed** property works in Safari is disputed:

- WebKit's Safari 18.0 notes say the prefix is no longer needed ([WebKit](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)).
- A February 2025 comment on WebKit bug 224899 says unprefixed support sat behind a feature flag ([WebKit bug 224899](https://bugs.webkit.org/show_bug.cgi?id=224899)).
- An MDN compatibility issue reports unprefixed `backdrop-filter` failing in Safari 18.3 ([MDN BCD #25914](https://github.com/mdn/browser-compat-data/issues/25914)).
- A July 2026 guide still says Safari requires the prefix ([flowrust](https://blog.flowrust.com/2026/07/15/backdrop-filter-stack-glassmorphism-survives-safari/)).

CSS variables are a second trap. WebKit bug 297620 shows `var()` inside backdrop-filter failing on macOS Sonoma whatever the Safari version, while a WebKit tester confirmed it works in Safari 26.1 on macOS 26 ([WebKit bug 297620](https://bugs.webkit.org/show_bug.cgi?id=297620)). **The safe pattern is to declare every rule twice, with literal values in the `-webkit-` line, and keep `var()` for `background` and shadows.**

Practitioners converge on these tuning ranges ([flowrust](https://blog.flowrust.com/2026/07/15/backdrop-filter-stack-glassmorphism-survives-safari/); [devyatov](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)):

- **Blur:** 4–8px is subtle, 10–16px reads as glass, and 20px or more washes out.
- **Saturation:** 1.2–1.8 restores the colour that blurring averages away.
- **Brightness:** 1.0–1.1 keeps text readable.
- **Transparency** is set by the tint's alpha, not by any filter setting.

The spec's **backdrop root** rule shapes the whole architecture. A backdrop-filter only sees pixels up to the nearest ancestor that is a backdrop root. Any of the following makes an element a backdrop root ([MDN: backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)):

- `filter`
- `opacity` below 1
- `mask` or `clip-path`
- `backdrop-filter`
- `mix-blend-mode` other than normal
- `will-change` naming any of these

This has two consequences. A glass thumb inside a glass bar blurs only the bar, not the page; this is the web's version of Apple's "glass cannot sample glass." And a glass panel nested in a host wrapper with `opacity: .99` silently loses its frost. In addition, ancestors with `overflow: hidden` clip the sampled region, and a backdrop-filter element becomes the containing block for `position: fixed` descendants ([devyatov](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)).

A backdrop-filter only samples pixels directly behind the element. Josh Comeau's fix is a taller, masked child layer that carries the backdrop-filter. As a side effect it lets nearby content bleed into the edge, which looks more optical ([Josh W. Comeau](https://www.joshwcomeau.com/css/backdrop-filter/)).

Safari 26 adds a twist for fixed top bars. It ignores `<meta name="theme-color">` and instead tints its own toolbar from either the body background or a `position: fixed` element at the top that is full-width and at least 6px tall ([grooovinger](https://grooovinger.com/notes/2026-02-27-safari-26-header-background); [Ben Frain](https://benfrain.com/ios26-safari-theme-color-tab-tinting-with-fixed-position-elements/)). One reverse-engineering write-up adds three claims: Safari also reads sticky elements and their `backdrop-filter`; it ignores an absolutely positioned visual child; and there is no Apple documentation for any of it ([1ar.io](https://1ar.io/updates/safari-26-liquid-glass-web/)). A glass top bar on ManageBac will probably recolour Safari's own chrome.

### Real refraction is Chromium-only, and every Safari workaround refracts a copy

The famous refraction demos feed an SVG `feDisplacementMap` to `backdrop-filter: url(#filter)`. kube.io, which built the most rigorous version, says plainly that "only Chrome currently supports using SVG filters as backdrop-filter" ([kube.io](https://kube.io/blog/liquid-glass-css-svg/)). It gets worse. Safari and Firefox parse the declaration and then "render nothing at all — not a degraded version, nothing." So `@supports` reports true, and a panel with no separate blur layer becomes a see-through hole ([devyatov](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07); [liquid-glass-js](https://github.com/Amir-Abushanab/liquid-glass-js)). The fix is in progress but unfinished:

- WebKit bug 245510 has been open since September 2022. Patches appeared in July 2026, and in September 2026 a commenter reported the linked test case "crashes the GPU process, repeatedly" ([WebKit bug 245510](https://bugs.webkit.org/show_bug.cgi?id=245510)).
- A June 2026 W3C issue asks for interoperable backdrop refraction. No browser engine had responded when last checked ([w3c/svgwg #1142](https://github.com/w3c/svgwg/issues/1142)).

Every refraction method that works in Safari operates on a **copy** of the page:

- **SVG `filter: url()` on cloned content** renders in all engines. It needs viewport-locked clones kept in sync with scrolling and DOM changes ([liquid-glass-js](https://github.com/Amir-Abushanab/liquid-glass-js); [samasante/liquid-glass](https://github.com/samasante/liquid-glass)).
- **WebGL over an html2canvas snapshot** (liquidGL) works in Safari, but it freezes the text under the glass and needs images that allow cross-origin (CORS) access. Its own docs say Safari "can be unstable when the liquid element(s) are more than 50% of the viewport width or height" ([liquidGL](https://github.com/naughtyduk/liquidGL/blob/main/README.md)).
- **Firefox's live `-moz-element()`** exists in no other browser ([MDN: element()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/element)).
- **Apple's own `-apple-visual-effect: -apple-system-glass-material`** exists in WebKit but only works inside an app's embedded WKWebView with a private setting turned on: "it doesn't work on the web" ([alastair.is](https://alastair.is/apple-has-a-private-css-property-to-add-liquid-glass-effects-to-web-content/)).

On a school portal full of changing lists and a scrolling timetable, none of these is worth the cost. **Skip refraction in the userscript.**

### Rims, sheens and shadows carry the "liquid" look

In Safari, glass looks liquid because of edge lighting, not refraction. Practitioner recipes combine ([WebTricks](https://webtricks.dev/blog/liquid-glass-css); [buildmvpfast](https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026)):

- several inset shadows: a strong top highlight plus softer ones on the sides and bottom;
- a brighter `border-top-color`;
- an outer drop shadow;
- a `::after` sheen made from a 135° white-to-transparent gradient with `mix-blend-mode: screen`.

A gradient rim can be drawn on a pseudo-element with `mask-composite: exclude` (or `-webkit-mask-composite: xor` for older WebKit) ([Temani Afif](https://dev.to/afif/border-with-gradient-and-radius-387f)). Pseudo-elements have no backdrop-filter of their own, so it does no harm that they become backdrop roots. iOS 27 added "darkened edges" and "brighter specular highlights" ([MacRumors](https://www.macrumors.com/2026/06/10/how-liquid-glass-is-changing-in-ios-27/)). To match the current look, add a faint dark outer hairline under the bright top rim.

The recipe below combines those sources with the accessibility ladder from the previous section. Its values are starting points, not Apple specifications.

```css
:root {
  --lg-tint:    rgba(255,255,255,.58);  /* small chrome: bar clusters, switcher track */
  --lg-tint-lg: rgba(255,255,255,.80);  /* large glass: dock, menus */
  --lg-solid:   rgb(246,246,248);
  --lg-rim:     rgba(255,255,255,.60);
  --lg-edge:    rgba(0,0,0,.10);        /* iOS 27-style darker outer edge */
}
@media (prefers-color-scheme: dark) {
  :root { --lg-tint: rgba(30,30,32,.55); --lg-tint-lg: rgba(30,30,32,.80);
          --lg-solid: rgb(28,28,30); --lg-rim: rgba(255,255,255,.22); --lg-edge: rgba(0,0,0,.5); }
}
.lg-glass {
  position: relative; isolation: isolate;
  background: var(--lg-tint);
  -webkit-backdrop-filter: blur(18px) saturate(180%);   /* literal values: never var() here */
  backdrop-filter: blur(18px) saturate(180%);
  border: 1px solid rgba(255,255,255,.25);
  border-top-color: var(--lg-rim);
  box-shadow: 0 0 0 .5px var(--lg-edge),
              inset 0 1px 1px var(--lg-rim),
              inset 0 -1px 1px rgba(255,255,255,.15),
              0 8px 28px rgba(0,0,0,.16);
}
.lg-glass::after {                         /* specular sheen */
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(135deg, rgba(255,255,255,.30), rgba(255,255,255,.05) 30%, transparent 60%);
  mix-blend-mode: screen;
}
.lg-large {                                /* dock, menus: thicker, more opaque, deeper shadow */
  background: var(--lg-tint-lg);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  backdrop-filter: blur(14px) saturate(160%);
  box-shadow: 0 0 0 .5px var(--lg-edge), inset 0 1px 1px var(--lg-rim), 0 18px 48px rgba(0,0,0,.22);
}
.lg-fill {                                 /* anything ON glass: switcher thumb, inner buttons */
  background: rgba(255,255,255,.88);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 1px 4px rgba(0,0,0,.14);
}
.lg-scroll-edge {                          /* soft scroll edge under a fixed top bar */
  position: fixed; top: 0; left: 0; right: 0; height: 72px; pointer-events: none;
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  -webkit-mask-image: linear-gradient(#000 40%, transparent); mask-image: linear-gradient(#000 40%, transparent);
  opacity: 0; transition: opacity .2s;
}
html.lg-scrolled .lg-scroll-edge { opacity: 1; }

/* Opacity ladder: Clear (default) → Tinted → Solid; Increase Contrast and future Safari support go solid */
html.lg-tinted .lg-glass { background: var(--lg-tint-lg); }
html.lg-solid .lg-glass { background: var(--lg-solid); -webkit-backdrop-filter: none; backdrop-filter: none; }
html.lg-solid .lg-glass::after { display: none; }
@media (prefers-reduced-transparency: reduce) {
  html .lg-glass { background: var(--lg-solid); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
@media (prefers-contrast: more) {
  html .lg-glass { background: var(--lg-solid); -webkit-backdrop-filter: none; backdrop-filter: none;
                   border: 2px solid currentColor; }
  html .lg-glass::after { display: none; }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .lg-glass { background: var(--lg-solid); }
}
@media (prefers-reduced-motion: no-preference) {
  .lg-thumb { transition: transform 420ms linear(0, .6 18%, 1.05 40%, .99 62%, 1); }
  .lg-press:active { transform: scale(.96); transition: transform 120ms ease-out; }
}
```

Three details are deliberate. The `-webkit-` lines hold literal values. The ladder rules are prefixed with `html` so they beat `.lg-large` on specificity. And `.lg-fill` carries no backdrop-filter, so anything that sits on glass avoids the backdrop-root trap. The spring curve and the 0.96 press scale are illustrative, because Apple publishes no motion parameters.

### Motion and performance must stay on the compositor

Animate only `transform` and `opacity`. "Never animate the blur radius": it forces full recompositing on every frame ([buildmvpfast](https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026)). Safari has the two tools needed for liquid motion:

- `linear()` easing since Safari 17.2, which is enough to draw a spring overshoot ([caniuse](https://caniuse.com/mdn-css_types_easing-function_linear-function)).
- Same-document View Transitions since Safari 18.0, which can morph a button into its menu ([caniuse](https://caniuse.com/view-transitions)).

No one has documented how Safari renders backdrop-filter inside a View Transition snapshot, so test before relying on it for glass panels.

Performance heuristics also converge ([flowrust](https://blog.flowrust.com/2026/07/15/backdrop-filter-stack-glassmorphism-survives-safari/); [buildmvpfast](https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026)):

- Keep each glass surface bounded in size.
- Cap blur at about 16–20px on large areas.
- Use no more than three or four glass layers per viewport.
- Add `will-change` only while an animation runs.

Static blur is close to free. Blur over content scrolling underneath is the expensive case ([devyatov](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07)). So the scrolled state should be a class toggled by an IntersectionObserver, not styles rewritten on every scroll event. These figures are community heuristics, mostly from mobile testing; no Safari-specific benchmark exists.

### Safari cannot read Reduce Transparency

`prefers-reduced-transparency` is not supported in any version of Safari on macOS or iOS through 27.2. Only Chromium 118+ supports it, and Firefox ships it disabled ([caniuse](https://caniuse.com/mdn-css_at-rules_media_prefers-reduced-transparency)). That breaks a common pattern. Turning glass on only under `(prefers-reduced-transparency: no-preference)` would leave every Safari user with solid surfaces ([buildmvpfast](https://www.buildmvpfast.com/blog/liquid-glass-css-backdrop-filter-recipes-2026)). The fix is to invert it: glass by default, with a solid fallback under any of these:

- `reduce`, which has no effect in Safari today but future-proofs the script;
- `prefers-contrast: more`;
- a class set by the script itself.

`prefers-contrast` has worked in Safari since 14.1 and maps to Increase Contrast ([caniuse](https://caniuse.com/mdn-css_at-rules_media_prefers-contrast)). Because Increase Contrast on macOS also forces Reduce Transparency, it is **the best available Safari proxy for "this user wants less glass"** ([TidBITS](https://tidbits.com/2025/10/09/how-to-turn-liquid-glass-into-a-solid-interface/)). `prefers-reduced-motion` has worked since Safari 10.1 ([caniuse](https://caniuse.com/prefers-reduced-motion)). Nothing exposes Apple's Clear/Tinted choice, the iOS 27 slider, or Reduce Bright Effects to web pages. A userscript therefore has to provide its own control. Safari 26 also added `contrast-color()`, which can pick a legible label colour for a given tint ([WebKit](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)).

## A ManageBac restyle should float the chrome and keep the timetable solid

Apple's macOS conventions translate most directly to a desktop school portal. Each ManageBac surface maps onto an Apple analogue:

| ManageBac element | Apple analogue | Recommended treatment |
|---|---|---|
| Top bar | Floating macOS toolbar | Two or three glass capsule clusters (navigation, switcher, icon actions); text actions on their own capsule; page title off glass; scroll-edge strip shown only when content is beneath |
| Tab switcher | Segmented control with its own glass | One glass capsule track; the thumb is a `.lg-fill` that moves by `transform` with a spring; selected segment uses a light fill and dark label |
| Side timetable dock | Inset floating sidebar (large glass) | Regular variant, high alpha (~0.75–0.85), blur ~12–16px, no light/dark flip, margin from window edges, concentric radius; lesson rows are fills, never glass |
| Menus and dropdowns | Menu popping from its button | Grow from the trigger, deeper shadow than the bar, high-alpha glass, single column of leading icons; must not sit inside another backdrop-filter element |
| Buttons | `.glass` / `.glassProminent` | Compact rounded rectangles in dense areas, capsules for large actions; one or two accent-filled primaries per view; no backdrop-filter on buttons inside glass |
| Cards, task lists, timetable grid, grades | Content layer | Solid or near-solid surfaces; subject colours live here, not in chrome |

### Top bar and tab switcher

The **top bar** should stop being one edge-to-edge slab. Apple's model is the floating macOS toolbar, so it should become separate glass groups: at most three, grouped by function, with text-labelled actions kept apart from icon clusters and non-interactive titles kept off glass ([HIG: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars); [WWDC25 session 310](https://developer.apple.com/videos/play/wwdc2025/310/)). Content scrolling under the bar gets a scroll-edge strip that appears only once something is actually underneath. Because a portal bar is dense, lean toward the more opaque style that Apple's 2026 "automatic" guidance gives crowded toolbars ([HIG: Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views)).

The current script styles `nav.navbar` as a full-width, 80%-white frosted slab (`/Users/tigercho/Desktop/js-managebac/ManageBac-Reimagined-Apple/ManageBac-Reimagined-Apple.user.js`, around line 280). If ManageBac positions that bar as fixed (or sticky, per one report), it is the element Safari 26 is likely to sample for its toolbar tint.

The **tab switcher** is the clearest case of the no-glass-on-glass rule. AppKit gives segmented controls their own glass ([WWDC25 session 310](https://developer.apple.com/videos/play/wwdc2025/310/)). The selected thumb sits on that glass, so it must be a fill. That suits Safari, because a backdrop-filter thumb inside a backdrop-filter track would only blur the track. The HIG reserves a white fill with a dark label for the toggled state ([HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)), which is exactly what a selected segment is. Move the thumb by setting `translateX()` and `scaleX()` from measured segment geometry. Add a brief lift scale during the move, echoing Apple's knobs that "lift up into Liquid Glass" while in use ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)).

### Timetable dock

The **side timetable dock** is the hardest element, because it combines two risks. It is a floating sidebar, which Apple explicitly puts in the glass layer. But it is also full of small, dense text, exactly the content that drew the 1.5:1 contrast readings and the "illegible mess" criticism. Apple's own answers point one way:

- Large glass "appears more opaque."
- Large glass does not flip between light and dark.
- Text-heavy components such as sidebars use the regular variant ([HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color); [WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/); [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)).

So give the dock a high tint alpha and a moderate blur. Inset it from the window edges with a concentric radius, the way macOS sidebars are inset ([WWDC25 session 356](https://developer.apple.com/videos/play/wwdc2025/356/)). Treat each lesson cell as content on solid fills. Every label then needs 4.5:1 against the brightest thing that can pass behind the dock. A tall glass pane over scrolling content is also the main performance risk, which is one more reason to lean opaque.

### Menus, buttons and content

**Menus** should pop from their trigger. Set `transform-origin` at the button, animate scale and opacity, and give the menu a deeper shadow than the bar, following Apple's "thicker" large glass ([WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)). There is a structural trap. The current script applies backdrop-filter directly to both `nav.navbar` and `.dropdown-menu`. If ManageBac's Bootstrap-style dropdowns are DOM descendants of that navbar, the bar is their backdrop root, and they blur only the bar, not the page. Two fixes work. One is to move the bar's frost onto a child or pseudo-element layer, so the bar itself is no longer a backdrop root. The other is to reparent open menus under `<body>`.

**Buttons** follow Apple's sizes and its colour budget:

- Compact rounded rectangles in dense areas, capsules for large actions.
- One or two accent-filled primaries per view, with the colour on the background and a white label ([HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color); [HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)).
- Buttons inside a glass cluster get a fill and rim but no backdrop-filter.
- On press, a small scale and a brighter rim, never a bright flash. A flash is exactly what iOS 26.4's Reduce Bright Effects exists to suppress.
- Large hit targets that do not move or collapse, given NN/g's complaints about cramped, disappearing controls ([NN/g](https://www.nngroup.com/articles/liquid-glass/)).

**Content** stays off glass entirely. Assignment cards, task lists, grade tables and the timetable grid live in the content layer, where subject colours belong. Labels in the chrome stay monochrome so a blue label never sits over a blue card ([HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)).

### Settings and adaptivity

**Settings** should copy Apple's ladder. Offer Clear, Tinted and Solid, saved through the script's existing `GM_setValue` store. Map `prefers-contrast: more` to Solid with borders, and `prefers-reduced-motion` to crossfades instead of springs. Default to Tinted, which is closer to iOS 27's midpoint than to the WWDC25 demos.

**Dynamic light/dark flipping** of the bar is the one Apple behaviour to skip. CSS cannot read what is behind an element. ManageBac's pages are mostly light, so static tuning for the worst-case backdrop gets most of the benefit at no cost.

## Conclusion

Safari's limitation turns out to be convenient. The one effect it cannot render, live lensing, is the effect critics blamed for distorted text, and the one Apple itself toned down in iOS 27 with more diffusion, darker edges and a tinted default. A frost-and-rim build in Safari therefore lands close to Apple's *current* look, rather than looking like a degraded copy of the WWDC25 demo.

The real gap is adaptivity, not optics. Apple's glass reads its backdrop to adjust tint, shadow and glyph colour. CSS cannot measure what sits behind an element, so the userscript has to replace live adaptation with worst-case tuning plus an explicit user choice. And because Safari cannot see Reduce Transparency, that in-page ladder is an accessibility requirement, not a nicety.

Watch WebKit bug 245510. If Safari starts painting `backdrop-filter: url()`, refraction becomes possible, and Apple's rules already say where it belongs. That place is not the bar or the dock over the timetable. It is the transient "lift" moment: the switcher thumb in mid-drag, small and free of text, where a lens actually helps by showing what is underneath. Until then, three questions stay open and should be tested on the target machine rather than trusted:

- whether unprefixed `backdrop-filter` works in shipping Safari;
- how glass behaves inside View Transitions;
- whether Safari 27, which shipped alongside macOS 27 in September 2026, changed any of this. It was not researched here.
