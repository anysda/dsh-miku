/**
 * Browser half: YYB Miku dances behind the app in the bottom right corner until
 * she is dragged elsewhere with the mouse. Page and surface backgrounds are
 * opaque to other content and receive only Miku's image beneath their contents.
 * Plugins and Automation tasks launch from the account menu;
 * its Sign in and Feedback rows are hidden.
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

		const SURFACE_TOKENS = [
			"--dsw-specific-input-major",
			"--dsw-specific-bubble",
			"--dsw-alias-markdown-inline-code",
			"--dsw-alias-markdown-code-block",
			"--dsw-alias-markdown-code-block-banner",
			"--dsw-specific-sidebar-fill",
			"--changes-fill",
			"--dsw-alias-bg-base",
		];
		const BASE_SURFACE_MARKER = "rgb(254, 8, 254)";
		const MARKER_COLOURS = new Set(SURFACE_TOKENS.map((_, index) => `rgb(254, ${index + 1}, 254)`));
		const EXTRA_SURFACES = [
			"[data-sidebar-right-guide-entry]",
			".hz8-rW_card",
			"[data-composer-seat]",
			'div:has(> [data-slot="sidebar.settings"])',
		].join(", ");
		const hasLabel = (element, label) => {
			if (!(element instanceof HTMLButtonElement)) return false;
			const aria = (element.getAttribute("aria-label") ?? "").trim();
			const text = element.textContent.replace(/\s+/g, " ").trim();
			return aria.toLowerCase() === label.toLowerCase() || text.startsWith(label);
		};
		const MIKU_SURFACE_OPACITY = 0.4;

		const STYLE = `
			html, body {
				--dsh-miku-accent: #39c5bb !important;
				--dsw-alias-brand-primary: var(--dsh-miku-accent) !important;
				--dsw-alias-brand-primary-new-colorprimary-new-color: var(--dsh-miku-accent) !important;
				--dsw-alias-button-info-fill: var(--dsh-miku-accent) !important;
				--dsw-alias-button-info-hover: color-mix(in srgb, var(--dsh-miku-accent) 85%, black) !important;
				--dsw-alias-button-primary-hover: color-mix(in srgb, var(--dsh-miku-accent) 85%, black) !important;
				--dsw-alias-onboarding-accent: var(--dsh-miku-accent) !important;
				--dsw-static-deepseek-50: color-mix(in srgb, var(--dsh-miku-accent) 10%, white) !important;
				--dsw-static-deepseek-100: color-mix(in srgb, var(--dsh-miku-accent) 20%, white) !important;
				--dsw-static-deepseek-200: color-mix(in srgb, var(--dsh-miku-accent) 35%, white) !important;
				--dsw-static-deepseek-300: color-mix(in srgb, var(--dsh-miku-accent) 55%, white) !important;
				--dsw-static-deepseek-400: var(--dsh-miku-accent) !important;
				--dsw-static-deepseek-450: var(--dsh-miku-accent) !important;
				--dsw-static-deepseek-500: var(--dsh-miku-accent) !important;
				--dsw-static-deepseek-600: color-mix(in srgb, var(--dsh-miku-accent) 85%, black) !important;
				--dsw-static-deepseek-700-delete: color-mix(in srgb, var(--dsh-miku-accent) 75%, black) !important;
				--dsw-static-deepseek-800: color-mix(in srgb, var(--dsh-miku-accent) 60%, black) !important;
				--dsw-static-deepseek-900: color-mix(in srgb, var(--dsh-miku-accent) 45%, black) !important;
			}
			#dsh-miku {
				position: fixed; z-index: -1; pointer-events: none;
				--side: 68vh;
				width: var(--side); height: var(--side); opacity: 0;
				/* the model stands in the middle of the frame, a fifth of its side above the bottom edge */
				right: -8vh; bottom: calc(24px - var(--side) * 0.2);
				transition: opacity ${FADE_MS}ms;
			}
			[data-dsh-miku-surface] {
				isolation: isolate;
			}
			.dsh-miku-window {
				position: absolute; inset: 0; z-index: -1; pointer-events: none;
				width: 100%; height: 100%; border-radius: inherit;
			}
			.dsh-miku-window--fixed {
				position: fixed; inset: auto;
			}
			[data-dsh-miku-panel-hidden], [data-dsh-miku-menu-hidden],
			[data-dsh-miku-chrome-hidden], [data-composer-dock], [data-sidebar-workspace-header],
			button[aria-label^="Access mode, current:"], button[aria-label="More tools"],
			[data-slot="conversation.hero.agentPreset"],
			div:has(> span):has(> div > button[aria-label="Add workspace"]) {
				display: none !important;
			}
			[data-composer-card] > :last-child {
				flex-wrap: nowrap !important;
				gap: 8px;
			}
			[data-composer-card] > :last-child > [data-input-scroll] {
				flex: 1 1 0;
				min-width: 0;
				max-height: calc(var(--dsh-composer-text-max-height, 336px) / 2);
				margin-right: 0;
			}
			[data-composer-card] [data-input-scroll] [contenteditable] {
				min-height: 18px !important;
				padding-top: 0 !important;
				line-height: 18px !important;
			}
			[data-composer-card] [data-composer-placeholder] {
				top: 0 !important;
				line-height: 18px !important;
			}
			header[data-dsh-miku-no-tabs] {
				min-height: 0;
				padding-bottom: 10px;
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

		/** Copies only Miku into opaque surface backgrounds, beneath their contents. */
		function createSurfaceWindows(source) {
			const surfaces = new Map();
			const markers = document.createElement("style");
			markers.textContent = `html, body, body * {${SURFACE_TOKENS.map(
				(token, index) => `${token}: rgb(254, ${index + 1}, 254) !important;`,
			).join("")}}`;

			const add = (element, base = false) => {
				if (!(element instanceof HTMLElement) || element.id === "dsh-miku" || surfaces.has(element)) return;
				const originalPosition = element.style.position;
				const style = getComputedStyle(element);
				if (style.position === "static") element.style.position = "relative";
				element.setAttribute("data-dsh-miku-surface", "");
				surfaces.set(element, {
					base,
					canvas: null,
					context: null,
					fixed: style.display === "inline",
					originalPosition,
				});
			};

			const scan = (roots) => {
				document.head.append(markers);
				try {
					for (const root of roots) {
						if (!(root instanceof HTMLElement) || root.classList.contains("dsh-miku-window")) continue;
						for (const element of [root, ...root.querySelectorAll("*")]) {
							const background = getComputedStyle(element).backgroundColor;
							const base = background === BASE_SURFACE_MARKER && element !== document.body;
							const labelled = ["More tools", "New Session"].some((label) => hasLabel(element, label));
							const marked = background !== BASE_SURFACE_MARKER && MARKER_COLOURS.has(background);
							if (base || labelled || marked || element.matches(EXTRA_SURFACES)) {
								add(element, base);
							}
						}
					}
				} finally {
					markers.remove();
				}
			};

			const remove = (element, record) => {
				record.canvas?.remove();
				element.removeAttribute("data-dsh-miku-surface");
				element.style.position = record.originalPosition;
				surfaces.delete(element);
			};

			const observer = new MutationObserver((mutations) => {
				const roots = mutations.flatMap(({ addedNodes }) => [...addedNodes]);
				if (roots.some((node) => node.nodeType === Node.ELEMENT_NODE)) scan(roots);
			});
			observer.observe(document.body, { childList: true, subtree: true });
			scan([document.body]);

			const render = () => {
				const sourceRect = source.getBoundingClientRect();
				const sourceOpacity = Number(getComputedStyle(source).opacity);
				for (const [element, record] of surfaces) {
					if (!element.isConnected) {
						remove(element, record);
						continue;
					}
					const opacity = sourceOpacity * (record.base ? 1 : MIKU_SURFACE_OPACITY);
					const rect = element.getBoundingClientRect();
					const left = Math.max(rect.left, sourceRect.left);
					const top = Math.max(rect.top, sourceRect.top);
					const right = Math.min(rect.right, sourceRect.right);
					const bottom = Math.min(rect.bottom, sourceRect.bottom);
					const visible = opacity > 0 && right > left && bottom > top;
					if (!visible && !record.canvas) continue;
					if (!record.canvas) {
						record.canvas = document.createElement("canvas");
						record.canvas.className = `dsh-miku-window${record.fixed ? " dsh-miku-window--fixed" : ""}`;
						record.context = record.canvas.getContext("2d");
						element.prepend(record.canvas);
					}
					const canvas = record.canvas;
					canvas.style.visibility = visible ? "visible" : "hidden";
					if (!visible) continue;
					canvas.style.opacity = String(opacity);
					if (record.fixed) {
						canvas.style.left = `${rect.left}px`;
						canvas.style.top = `${rect.top}px`;
						canvas.style.width = `${rect.width}px`;
						canvas.style.height = `${rect.height}px`;
					}
					const dpr = window.devicePixelRatio || 1;
					const width = Math.max(1, Math.round(rect.width * dpr));
					const height = Math.max(1, Math.round(rect.height * dpr));
					if (canvas.width !== width) canvas.width = width;
					if (canvas.height !== height) canvas.height = height;
					const context = record.context;
					context.setTransform(1, 0, 0, 1, 0, 0);
					context.clearRect(0, 0, width, height);
					context.setTransform(dpr, 0, 0, dpr, 0, 0);
					context.drawImage(
						source,
						(left - sourceRect.left) * source.width / sourceRect.width,
						(top - sourceRect.top) * source.height / sourceRect.height,
						(right - left) * source.width / sourceRect.width,
						(bottom - top) * source.height / sourceRect.height,
						left - rect.left,
						top - rect.top,
						right - left,
						bottom - top,
					);
				}
			};

			const dispose = () => {
				observer.disconnect();
				markers.remove();
				for (const [element, record] of [...surfaces]) remove(element, record);
			};
			return { render, dispose };
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

		/** Moves panel launchers into the account menu and trims that menu. */
		function organizeSidebar() {
			const labels = ["Plugins", "Automation tasks", "Add workspace"];
			const hiddenLabels = ["Plugins", "Automation tasks", "More"];
			const customizeMenu = (menu) => {
				const items = [...menu.querySelectorAll('[role="menuitem"]')];
				const unwanted = items.filter((item) => ["Sign in", "Feedback"].includes(item.textContent.trim()));
				if (unwanted.length === 0) return;
				for (const item of unwanted) item.setAttribute("data-dsh-miku-menu-hidden", "");
				const template = unwanted[0];
				for (const label of labels) {
					if (menu.querySelector(`[data-dsh-miku-menu-item="${label}"]`)) continue;
					const original = [...document.querySelectorAll("button")].find((button) => hasLabel(button, label));
					if (!original) continue;
					const clone = template.cloneNode(true);
					clone.removeAttribute("id");
					clone.removeAttribute("disabled");
					clone.removeAttribute("aria-disabled");
					clone.removeAttribute("aria-describedby");
					clone.removeAttribute("data-dsh-miku-menu-hidden");
					clone.setAttribute("aria-label", label);
					clone.setAttribute("data-dsh-miku-menu-item", label);
					clone.textContent = label;
					const icon = original.querySelector("svg");
					if (icon) clone.prepend(icon.cloneNode(true));
					clone.addEventListener("click", (event) => {
						event.preventDefault();
						event.stopPropagation();
						const button = [...document.querySelectorAll("button")].find((candidate) => hasLabel(candidate, label));
						button?.click();
						clone.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
					});
					menu.append(clone);
				}
			};

			const sync = (root) => {
				if (!(root instanceof HTMLElement)) return;
				for (const element of [root, ...root.querySelectorAll("*")]) {
					if (element.closest("nav") && hiddenLabels.some((label) => hasLabel(element, label))) {
						let row = element;
						while (row.parentElement && row.parentElement.tagName !== "NAV") row = row.parentElement;
						row.setAttribute("data-dsh-miku-panel-hidden", "");
					}
					if (element.matches('[role="menu"]')) customizeMenu(element);
				}
			};
			const observer = new MutationObserver((mutations) => {
				for (const { addedNodes } of mutations) for (const node of addedNodes) sync(node);
			});
			observer.observe(document.body, { childList: true, subtree: true });
			sync(document.body);
			return () => {
				observer.disconnect();
				for (const element of document.querySelectorAll("[data-dsh-miku-panel-hidden], [data-dsh-miku-menu-hidden]")) {
					element.removeAttribute("data-dsh-miku-panel-hidden");
					element.removeAttribute("data-dsh-miku-menu-hidden");
				}
				for (const clone of document.querySelectorAll("[data-dsh-miku-menu-item]")) clone.remove();
			};
		}

		/** Forces Full access for new and already materialized sessions. */
		function forceFullAccess(ctx) {
			const preset = "danger-full-access";
			const forced = new Set();
			const pending = new Set();

			return (sessionId) => {
				if (!sessionId || forced.has(sessionId) || pending.has(sessionId)) return;
				const session = ctx.sessions?.binding(sessionId)?.session;
				if (!session) return;
				const selection = session.projections.faceOf("permissions").getSnapshot();
				if (selection?.currentValue === preset) {
					forced.add(sessionId);
					return;
				}
				pending.add(sessionId);
				void session.command(`/permission ${preset}`).then((result) => {
					if (!result.ok) throw new Error(result.error?.message ?? "permission switch failed");
					if (!result.value.matched) throw new Error("the host offers no /permission command");
					forced.add(sessionId);
				}).catch((error) => console.error(`[miku] failed to set Full access for ${sessionId}:`, error))
					.finally(() => pending.delete(sessionId));
			};
		}

		/** Removes conversation chrome that is not part of the chat itself. */
		function cleanConversationChrome(forceSession) {
			const renamedTexts = new Map();
			const modelHomes = new Map();
			const contextHomes = new Map();
			const editorHomes = new Map();
			const hide = (element) => element.setAttribute("data-dsh-miku-chrome-hidden", "");
			const renameTeam = (element) => {
				const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
				for (let node = walker.nextNode(); node; node = walker.nextNode()) {
					if (!/^Agent team(?:work)?$/i.test(node.nodeValue.trim())) continue;
					if (!renamedTexts.has(node)) renamedTexts.set(node, node.nodeValue);
					node.nodeValue = node.nodeValue.replace(/Agent team(?:work)?/i, "Team");
				}
			};
			const hidePermissionSelect = (element) => {
				const button = element.closest('button[aria-label^="Access mode, current:"]');
				if (button) hide(button);
			};
			const moveModelSelect = (element) => {
				const model = element.closest('[data-slot="conversation.input.model"]');
				if (!model) return;
				const root = modelHomes.get(model)?.root ?? model.closest("[data-conversation-content]")?.closest("[data-phase]");
				const header = root?.querySelector("[data-conversation-header-corner]")?.closest("header");
				const title = header?.querySelector("nav");
				const cluster = title?.parentElement;
				if (!cluster) return;
				const actions = [...cluster.children].find((child) => child !== title
					&& !child.matches('[data-slot="conversation.input.model"]') && !contextHomes.has(child));
				if (!actions || (model.parentElement === cluster && model.nextElementSibling === actions)) return;
				if (!modelHomes.has(model)) {
					modelHomes.set(model, { parent: model.parentElement, next: model.nextElementSibling, root });
				}
				cluster.insertBefore(model, actions);
			};
			const moveContextMeter = (element) => {
				const dock = element.closest("[data-composer-dock]");
				if (!dock) return;
				const button = [...dock.querySelectorAll('button[aria-haspopup="dialog"]')]
					.find((candidate) => !candidate.closest("[data-composer-stat]"));
				const meter = button?.parentElement;
				if (!meter) return;
				const root = contextHomes.get(meter)?.root ?? dock.closest("[data-conversation-content]")?.closest("[data-phase]");
				const model = root?.querySelector('[data-slot="conversation.input.model"]');
				if (!model) return;
				moveModelSelect(model);
				const cluster = model.parentElement;
				if (!cluster?.querySelector(":scope > nav")) return;
				if (meter.parentElement === cluster && meter.nextElementSibling === model) return;
				if (!contextHomes.has(meter)) {
					contextHomes.set(meter, { parent: meter.parentElement, next: meter.nextElementSibling, root });
				}
				cluster.insertBefore(meter, model);
			};
			const compactComposer = (element) => {
				const card = element.closest("[data-composer-card]");
				if (!card) return;
				for (const editor of card.querySelectorAll("[data-input-scroll]")) {
					const row = card.lastElementChild;
					const trailing = row?.lastElementChild;
					if (!row || row === editor || !trailing || trailing === editor) continue;
					if (editor.parentElement === row && editor.nextElementSibling === trailing) continue;
					if (!editorHomes.has(editor)) editorHomes.set(editor, { parent: editor.parentElement, next: editor.nextElementSibling });
					row.insertBefore(editor, trailing);
				}
			};
			const hideHeaderMenu = (corner) => {
				const buttons = corner.previousElementSibling?.querySelectorAll("button") ?? [];
				if (buttons.length > 0) hide(buttons[buttons.length - 1]);
			};
			const clean = (element) => {
				compactComposer(element);
				moveModelSelect(element);
				if (element.matches("[data-conversation-header-corner]")) {
					for (const model of document.querySelectorAll('[data-slot="conversation.input.model"]')) moveModelSelect(model);
				}
				if (element.matches('[data-slot="conversation.input.model"], [data-conversation-header-corner]')) {
					for (const dock of document.querySelectorAll("[data-composer-dock]")) moveContextMeter(dock);
				}
				moveContextMeter(element);
				hidePermissionSelect(element);
				if (element.matches("[data-conversation-session]")) forceSession(element.getAttribute("data-conversation-session"));
				if (element.matches('[data-conversation-tabs] [role="tab"]') && ["Trajectory", "Chat"].includes(element.textContent.trim())) {
					const tabList = element.closest("[data-conversation-tabs]");
					if (element.textContent.trim() === "Trajectory" && element.getAttribute("aria-selected") === "true") {
						const chat = [...tabList.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.trim() === "Chat");
						chat?.click();
					}
					hide(element);
					const strip = tabList.parentElement;
					for (const button of strip.querySelectorAll('button[aria-haspopup="menu"]')) {
						if (!tabList.contains(button)) hide(button);
					}
					const remaining = [...tabList.querySelectorAll('[role="tab"]')].some((tab) => !tab.hasAttribute("data-dsh-miku-chrome-hidden"));
					const header = strip.closest("header");
					if (remaining) {
						strip.removeAttribute("data-dsh-miku-chrome-hidden");
						header?.removeAttribute("data-dsh-miku-no-tabs");
					} else {
						hide(strip);
						header?.setAttribute("data-dsh-miku-no-tabs", "");
					}
				}
				if (["More conversation views", "More tools"].some((label) => hasLabel(element, label))) hide(element);
				const header = element.closest("header");
				const corner = element.closest("[data-conversation-header-corner]");
				if (corner) hideHeaderMenu(corner);
				if (hasLabel(element, "More actions") && header?.querySelector("[data-conversation-header-corner]")) hide(element);
				if (element.matches("span[title]") && header?.querySelector("[data-conversation-header-corner]")) {
					if (/\bmode\b/i.test(element.textContent.trim())) hide(element);
				}
				if ((header?.querySelector("[data-conversation-header-corner]") || element.closest('[data-model-menu-pane="agent-team"]'))
					&& element.matches("span, button")) renameTeam(element);
			};
			const sync = (root) => {
				if (!(root instanceof HTMLElement)) return;
				for (const element of [root, ...root.querySelectorAll("*")]) clean(element);
			};
			const observer = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					if (mutation.type === "characterData") {
						sync(mutation.target.parentElement);
						continue;
					}
					for (const node of mutation.addedNodes) {
						if (node.nodeType === Node.TEXT_NODE) sync(node.parentElement);
						else sync(node);
					}
				}
			});
			observer.observe(document.body, { childList: true, subtree: true, characterData: true });
			sync(document.body);
			return () => {
				observer.disconnect();
				for (const [editor, home] of editorHomes) {
					if (editor.isConnected && home.parent.isConnected) {
						home.parent.insertBefore(editor, home.next?.isConnected ? home.next : null);
					}
				}
				for (const [meter, home] of contextHomes) {
					if (meter.isConnected && home.parent.isConnected) {
						home.parent.insertBefore(meter, home.next?.isConnected ? home.next : null);
					}
				}
				for (const [model, home] of modelHomes) {
					if (model.isConnected && home.parent.isConnected) {
						home.parent.insertBefore(model, home.next?.isConnected ? home.next : null);
					}
				}
				for (const element of document.querySelectorAll("[data-dsh-miku-chrome-hidden], [data-dsh-miku-no-tabs]")) {
					element.removeAttribute("data-dsh-miku-chrome-hidden");
					element.removeAttribute("data-dsh-miku-no-tabs");
				}
				for (const [node, text] of renamedTexts) if (node.isConnected) node.nodeValue = text;
			};
		}

		async function runStage(canvas, signal) {
			const [{ startMiku }, dances] = await Promise.all([
				import(`${ASSETS}/miku-stage.js`),
				fetch(`${ASSETS}/dances/`).then((response) => response.json()),
			]);
			const miku = await startMiku(canvas, { model: `${ASSETS}/yyb/YYBMikuShiny.pmx`, sizePx: CANVAS_PX });
			const surfaceWindows = createSurfaceWindows(canvas);
			const renderFrame = () => {
				if (signal.aborted) return;
				miku.render();
				surfaceWindows.render();
				requestAnimationFrame(renderFrame);
			};
			try {
				renderFrame();
				await cycleDances(miku, dances, canvas, signal);
			} finally {
				// the plugin can be reloaded without a page reload; the scene must not outlive it
				surfaceWindows.dispose();
				miku.dispose();
			}
		}

		function apply(ctx) {
			const style = document.createElement("style");
			style.textContent = STYLE;
			document.head.append(style);
			const restoreSidebar = organizeSidebar();
			const restoreConversation = cleanConversationChrome(forceFullAccess(ctx));
			const canvas = document.createElement("canvas");
			canvas.id = "dsh-miku";
			document.body.append(canvas);

			const abort = new AbortController();
			makeDraggable(canvas, abort.signal);
			runStage(canvas, abort.signal).catch((err) => console.error("[miku] stage failed:", err));

			ctx.effect(() => () => {
				abort.abort();
				restoreSidebar();
				restoreConversation();
				canvas.remove();
				style.remove();
			});
		}

		return { apply };
	},
});
