// Miku on babylon-mmd: a transparent canvas with one model that switches dances.
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Materials/Textures/Loaders/tgaTextureLoader";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Loading/loadingScreen";
import "babylon-mmd/esm/Loader/mmdModelLoader";
import "babylon-mmd/esm/Loader/pmxLoader";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { SdefInjector } from "babylon-mmd/esm/Loader/sdefInjector";
import { VmdLoader } from "babylon-mmd/esm/Loader/vmdLoader";
import { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime";
import { MmdStandardMaterialProxy } from "babylon-mmd/esm/Runtime/mmdStandardMaterialProxy";
import { GetMmdWasmInstance } from "babylon-mmd/esm/Runtime/Optimized/mmdWasmInstance";
import { MmdWasmInstanceTypeSPR } from "babylon-mmd/esm/Runtime/Optimized/InstanceType/singlePhysicsRelease";
import { MultiPhysicsRuntime } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/Impl/multiPhysicsRuntime";
import { MmdBulletPhysics } from "babylon-mmd/esm/Runtime/Optimized/Physics/mmdBulletPhysics";

// frame rate every MMD motion is keyed at
const MMD_FPS = 30;
// MMD units: the model is 20 tall and a dance carries it a few units off the origin,
// so the square frame is about 34 wide
const CAMERA_HEIGHT = 10;
const CAMERA_DISTANCE = 64;
const CAMERA_FOV_RAD = (30 * Math.PI) / 180;
// MMD physics is tuned for ten times the real 9.8
const GRAVITY = -98;
// Miku's teal
const FILL_COLOUR = new Color3(0.53, 0.95, 0.91);

function addCameraAndLights(scene) {
	// MMD models face -z
	const camera = new UniversalCamera("camera", new Vector3(0, CAMERA_HEIGHT, -CAMERA_DISTANCE), scene);
	camera.setTarget(new Vector3(0, CAMERA_HEIGHT, 0));
	camera.fov = CAMERA_FOV_RAD;
	camera.minZ = 1;
	camera.maxZ = 2000;

	const key = new DirectionalLight("key", new Vector3(0.5, -1, 1), scene);
	key.intensity = 1.0;
	const fill = new HemisphericLight("fill", new Vector3(0, 1, 0), scene);
	fill.intensity = 0.25;
	fill.diffuse = fill.groundColor = FILL_COLOUR;
	fill.specular = new Color3(0, 0, 0);
}

/** Loads the model into the scene with physics; resolves to the MMD runtime and its model. */
async function loadModel(scene, modelUrl) {
	const physics = new MultiPhysicsRuntime(await GetMmdWasmInstance(new MmdWasmInstanceTypeSPR()));
	physics.setGravity(new Vector3(0, GRAVITY, 0));
	physics.register(scene);
	const runtime = new MmdRuntime(scene, new MmdBulletPhysics(physics));
	runtime.register(scene);

	const container = await LoadAssetContainerAsync(modelUrl, scene);
	container.addAllToScene();
	const mmdModel = runtime.createMmdModel(container.meshes[0], { materialProxyConstructor: MmdStandardMaterialProxy });
	return { runtime, mmdModel };
}

/** Starts the scene; resolves to `dance(url, seconds)`, `render()` and `dispose()`. */
export async function startMiku(canvas, { model, sizePx }) {
	const engine = new Engine(canvas, true, { alpha: true, premultipliedAlpha: false, stencil: true }, false);
	engine.setSize(sizePx, sizePx);
	SdefInjector.OverrideEngineCreateEffect(engine);
	const scene = new Scene(engine);
	scene.clearColor = new Color4(0, 0, 0, 0);
	scene.ambientColor = new Color3(0.5, 0.5, 0.5);
	addCameraAndLights(scene);

	// the texture cache outlives a scene: unless the engine goes too, a second start in the
	// same page gets textures of the dead WebGL context and the model comes out black
	const dispose = () => {
		scene.dispose();
		engine.dispose();
	};
	const { runtime, mmdModel } = await loadModel(scene, model).catch((err) => {
		dispose();
		throw err;
	});
	const vmdLoader = new VmdLoader(scene);
	const animationByUrl = new Map();

	return {
		/** Plays `seconds` of the dance from a random moment; returns how long it will really play. */
		async dance(url, seconds) {
			if (!animationByUrl.has(url)) {
				animationByUrl.set(url, mmdModel.createRuntimeAnimation(await vmdLoader.loadAsync(url, url)));
			}
			mmdModel.setRuntimeAnimation(animationByUrl.get(url));
			const totalFrames = runtime.animationFrameTimeDuration;
			const lengthFrames = Math.min(seconds * MMD_FPS, totalFrames);
			await runtime.seekAnimation(Math.random() * (totalFrames - lengthFrames), true);
			// hair and skirt would otherwise fly in from the previous pose
			mmdModel.initializePhysics();
			await runtime.playAnimation();
			return lengthFrames / MMD_FPS;
		},
		render() {
			engine.beginFrame();
			scene.render();
			engine.endFrame();
		},
		dispose,
	};
}
