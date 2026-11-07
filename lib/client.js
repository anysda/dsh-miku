/**
 * Browser half: YYB Miku dances behind the app in the bottom right corner until
 * she is dragged elsewhere with the mouse. Page background, input field, sent
 * messages, inline code, code blocks, the edited-files card and sidebar let her
 * show through.
 */
window.__ModuleLoader__.load({
	id: "dsh-miku",
	factory: () => {
		const ASSETS = "/miku-assets";
		// canvas render size, px
		const CANVAS_PX = 900;
		// half-width of the part of the square frame that answers to the mouse, in frame sides
		const BODY_HALF_WIDTH = 0.2;
		// seconds of one dance before the next is drawn
		const DANCE_S = 30;
		const FADE_MS = 500;
		const CONTROLS = 'button, a, input, textarea, select, [contenteditable], [role="button"]';

		const translucent = (token) => `color-mix(in srgb, var(${token}) 60%, transparent)`;
		// the app paints the base token over the whole page; the same colour stays on <body> underneath
		const TOKENS = {
			"--dsw-alias-bg-base": { light: "transparent", dark: "transparent" },
			"--dsw-specific-input-major": {
				light: translucent("--dsw-static-neutral-bluish-00"),
				dark: translucent("--dsw-static-neutral-bluish-850"),
			},
			"--dsw-specific-bubble": {
				light: translucent("--dsw-static-deepseek-50"),
				dark: translucent("--dsw-static-neutral-bluish-850"),
			},
			"--dsw-alias-markdown-inline-code": {
				light: translucent("--dsw-static-neutral-50"),
				dark: translucent("--dsw-static-neutral-800"),
			},
			"--dsw-alias-markdown-code-block": {
				light: translucent("--dsw-static-neutral-bluish-50"),
				dark: translucent("--dsw-static-neutral-bluish-900"),
			},
			"--dsw-alias-markdown-code-block-banner": {
				light: translucent("--dsw-static-neutral-bluish-50"),
				dark: translucent("--dsw-static-neutral-bluish-850"),
			},
			"--dsw-specific-sidebar-fill": {
				light: translucent("--dsw-static-neutral-bluish-50"),
				dark: translucent("--dsw-static-neutral-bluish-900"),
			},
		};

		const STYLE = `
			#dsh-miku {
				position: fixed; z-index: -1; pointer-events: none;
				--side: 68vh;
				width: var(--side); height: var(--side); opacity: 0;
				/* the model stands in the middle of the frame, a fifth of its side above the bottom edge */
				right: -8vh; bottom: calc(24px - var(--side) * 0.2);
				transition: opacity ${FADE_MS}ms;
			}
			/* the edited-files card paints its own fill, not a theme token */
			html body .hz8-rW_card {
				background: ${translucent("--dsw-alias-bg-layer-1")};
				--changes-fill: ${translucent("--dsw-static-neutral-50")};
			}
			html body[data-ds-dark-theme] .hz8-rW_card {
				--changes-fill: ${translucent("--dsw-static-neutral-850")};
			}
		`;

		const pick = (items) => items[Math.floor(Math.random() * items.length)];

		/** Resolves after `ms`, or at once when the plugin is unloaded. */
		function sleep(ms, signal) {
			return new Promise((resolve) => {
				const finish = () => {
					clearTimeout(timer);
					signal.removeEventListener("abort", finish);
					resolve();
				};
				const timer = setTimeout(finish, ms);
				signal.addEventListener("abort", finish);
			});
		}

		/** Lets the mouse drag her by the body. */
		function makeDraggable(canvas, signal) {
			let offset = { x: 0, y: 0 };
			// where the pointer took hold of her, relative to her offset; null while she is not held
			let grip = null;
			window.addEventListener(
				"pointerdown",
				(event) => {
					const box = canvas.getBoundingClientRect();
					const offCentre = Math.abs(event.clientX - (box.left + box.width / 2));
					const inside = offCentre < box.width * BODY_HALF_WIDTH && event.clientY > box.top && event.clientY < box.bottom;
					// she is behind the app: controls above her keep their clicks
					if (!inside || event.button !== 0 || event.target.closest(CONTROLS)) return;
					grip = { x: event.clientX - offset.x, y: event.clientY - offset.y };
					event.preventDefault();
				},
				{ capture: true, signal },
			);
			window.addEventListener(
				"pointermove",
				(event) => {
					if (grip === null) return;
					offset = { x: event.clientX - grip.x, y: event.clientY - grip.y };
					canvas.style.translate = `${offset.x}px ${offset.y}px`;
				},
				{ signal },
			);
			const release = () => (grip = null);
			window.addEventListener("pointerup", release, { signal });
			window.addEventListener("pointercancel", release, { signal });
		}

		/** Plays one random dance after another until the plugin is unloaded. */
		async function cycleDances(miku, dances, canvas, signal) {
			let current;
			while (!signal.aborted) {
				const others = dances.filter((dance) => dance !== current);
				current = pick(others.length > 0 ? others : dances);
				// the jump between dances happens while she is faded out
				canvas.style.opacity = "0";
				await sleep(FADE_MS, signal);
				if (signal.aborted) return;
				const seconds = await miku.dance(`${ASSETS}/dances/${current}`, DANCE_S);
				canvas.style.opacity = "1";
				await sleep(seconds * 1000, signal);
			}
		}

		async function runStage(canvas, signal) {
			const [{ startMiku }, dances] = await Promise.all([
				import(`${ASSETS}/miku-stage.js`),
				fetch(`${ASSETS}/dances/`).then((response) => response.json()),
			]);
			const miku = await startMiku(canvas, { model: `${ASSETS}/yyb/YYBMikuShiny.pmx`, sizePx: CANVAS_PX });
			const renderFrame = () => {
				if (signal.aborted) return;
				miku.render();
				requestAnimationFrame(renderFrame);
			};
			try {
				renderFrame();
				await cycleDances(miku, dances, canvas, signal);
			} finally {
				// the plugin can be reloaded without a page reload; the scene must not outlive it
				miku.dispose();
			}
		}

		function apply(ctx) {
			const restoreTokens = ctx.theme.overrideTokens("dsh-miku", TOKENS);
			const style = document.createElement("style");
			style.textContent = STYLE;
			document.head.append(style);
			const canvas = document.createElement("canvas");
			canvas.id = "dsh-miku";
			document.body.append(canvas);

			const abort = new AbortController();
			makeDraggable(canvas, abort.signal);
			runStage(canvas, abort.signal).catch((err) => console.error("[miku] stage failed:", err));

			ctx.effect(() => () => {
				abort.abort();
				canvas.remove();
				style.remove();
				restoreTokens();
			});
		}

		return { apply, inject: ["theme"] };
	},
});
