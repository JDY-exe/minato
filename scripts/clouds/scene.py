"""Generate a complete, editable Cycles cloud scene without manual modeling.

This is an art-directed procedural volume, not a moist-fluid simulation.
All animation is a deterministic function of frame number, including rewind.
"""
import argparse
import json
import math
from pathlib import Path
import random
import sys
import time

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--seed', type=int, default=7)
parser.add_argument('--quality', choices=['draft', 'production'], default='draft')
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--still', action='store_true')
parser.add_argument('--scene-only', action='store_true')
parser.add_argument('--cpu', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
settings = json.loads((Path(__file__).parent / 'config.json').read_text())['presets'][args.quality]
rng = random.Random(args.seed)
args.output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene.render.engine = 'CYCLES'
scene.cycles.samples = settings['samples']
scene.cycles.use_denoising = True
scene.cycles.volume_bounces = settings['volumeBounces']
scene.cycles.max_bounces = max(8, settings['volumeBounces'] + 2)
scene.cycles.seed = args.seed
# Fixed sampling seed avoids introducing independent noise in every frame.
scene.cycles.use_animated_seed = False
scene.render.resolution_x = settings['width']
scene.render.resolution_y = settings['height']
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = settings['frames']
scene.view_settings.view_transform = 'AgX'
if not args.cpu:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for backend in (['METAL'] if sys.platform == 'darwin' else ['OPTIX', 'CUDA']):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            gpu_devices = [device for device in prefs.devices if device.type == backend]
            if not gpu_devices:
                continue
            for device in prefs.devices:
                device.use = device.type == backend
            scene.cycles.device = 'GPU'
            print(f'Rendering with {backend}:', [device.name for device in gpu_devices], flush=True)
            break
        except Exception as error:
            print(f'{backend} unavailable:', error, flush=True)
    else:
        print('No supported GPU found; using CPU.', flush=True)

world = bpy.data.worlds.new('Summer skylight')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.64, 0.80, 0.91, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.45
scene.world = world
bpy.ops.object.light_add(type='SUN', location=(-12, -12, 24))
sun = bpy.context.object
sun.name = 'Summer sun'
sun.rotation_euler = (math.radians(24), math.radians(-32), math.radians(-28))
sun.data.energy = 3.2
sun.data.angle = math.radians(4)
sun.data.color = (1.0, 0.965, 0.89)

def cloud(name, centers, location, scale, density):
    material = bpy.data.materials.new(name + ' / procedural density')
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    def node(kind, label):
        result = tree.nodes.new(kind)
        result.label = label
        return result
    def math_node(operation, a, b=0):
        result = node('ShaderNodeMath', operation)
        result.operation = operation
        for i, value in enumerate([a, b]):
            if isinstance(value, (int, float)):
                result.inputs[i].default_value = value
            else:
                tree.links.new(value, result.inputs[i])
        return result.outputs[0]
    coordinates = node('ShaderNodeTexCoord', 'Cloud-local coordinates')
    accumulated = 0
    for index, (center, radii) in enumerate(centers):
        offset = node('ShaderNodeVectorMath', 'Lobe center')
        offset.operation = 'SUBTRACT'
        tree.links.new(coordinates.outputs['Object'], offset.inputs[0])
        start = Vector(center)
        finish = start + Vector((0.8, 0.08, 0.20 + max(center[2], 0) * 0.035))
        offset.inputs[1].default_value = start
        offset.inputs[1].keyframe_insert('default_value', frame=1)
        offset.inputs[1].default_value = finish
        offset.inputs[1].keyframe_insert('default_value', frame=settings['frames'])
        divide = node('ShaderNodeVectorMath', 'Ellipsoid proportions')
        divide.operation = 'DIVIDE'
        tree.links.new(offset.outputs['Vector'], divide.inputs[0])
        divide.inputs[1].default_value = radii
        length = node('ShaderNodeVectorMath', 'Ellipsoid radius')
        length.operation = 'LENGTH'
        tree.links.new(divide.outputs['Vector'], length.inputs[0])
        kernel = math_node('MAXIMUM', math_node('SUBTRACT', 1, length.outputs['Value']), 0)
        accumulated = math_node('ADD', accumulated, math_node('MULTIPLY', kernel, 1.8))
    noise = node('ShaderNodeTexNoise', 'Advected billow erosion')
    noise.noise_dimensions = '4D'
    tree.links.new(coordinates.outputs['Object'], noise.inputs['Vector'])
    noise.inputs['Scale'].default_value = 1.55
    noise.inputs['Detail'].default_value = 3
    noise.inputs['Roughness'].default_value = 0.62
    noise.inputs['W'].default_value = rng.uniform(0, 30)
    noise.inputs['W'].keyframe_insert('default_value', frame=1)
    noise.inputs['W'].default_value += 0.22
    noise.inputs['W'].keyframe_insert('default_value', frame=settings['frames'])
    # A connected macro field survives subtractive high-frequency erosion.
    eroded = math_node('SUBTRACT', accumulated, math_node('MULTIPLY', noise.outputs['Fac'], 0.65))
    bounded = math_node('MINIMUM', math_node('MAXIMUM', eroded, 0), 1)
    volume = node('ShaderNodeVolumePrincipled', 'Multiple-scattered cloud water')
    tree.links.new(math_node('MULTIPLY', bounded, density), volume.inputs['Density'])
    volume.inputs['Color'].default_value = (0.985, 0.99, 1.0, 1)
    volume.inputs['Anisotropy'].default_value = 0.35
    output = node('ShaderNodeOutputMaterial', 'Cloud volume')
    tree.links.new(volume.outputs['Volume'], output.inputs['Volume'])
    bpy.ops.mesh.primitive_cube_add(size=2, location=location)
    obj = bpy.context.object
    obj.name = name
    # Mesh contains the entire local implicit volume, including animation bounds.
    # Apply only the mesh size; keep local coordinates in physical lobe units.
    for vertex in obj.data.vertices:
        vertex.co.x *= 12
        vertex.co.y *= 8
        vertex.co.z *= 15
    obj.scale = scale
    obj.data.materials.append(material)
    return obj

def tower_centers(height=1.0):
    centers = []
    # Broad connected foundation, narrowing upward into asymmetric rising crowns.
    for x in [-4.5, -1.5, 1.5, 4.5]:
        centers.append(((x, rng.uniform(-0.6, 0.6), -2.0), (3.5, 2.8, 2.5)))
    for x, y, z, radius in [(-2.7, 0.4, 0.3, 3.0), (1.1, 0, 1.4, 3.3),
                             (3.0, 0.5, 3.1, 2.5), (0.5, 0, 4.9, 2.9),
                             (-0.3, 0.4, 7.1, 2.5), (1.2, 0.2, 8.5, 1.8)]:
        centers.append(((x + rng.uniform(-0.4, 0.4), y, z * height),
                        (radius, radius * 0.85, radius * rng.uniform(0.90, 1.15))))
    # Smaller crown lobes carry the cauliflower silhouette rather than noise alone.
    for _ in range(13):
        z = rng.uniform(0.5, 8.5) * height
        x = rng.uniform(-2.2, 2.5) + 0.6 * math.sin(z)
        radius = rng.uniform(0.8, 1.45)
        centers.append(((x, rng.uniform(-2.0, -0.8), z), (radius, radius, radius * 1.1)))
    return centers

cloud('Main rising tower', tower_centers(rng.uniform(0.9, 1.08)), (5, 1, 4), (1, 1, 1), 1.6)
cloud('Distant summer bank', tower_centers(0.45), (-10, 14, 1.6), (0.90, 0.75, 0.70), 1.1)
cloud('Near cropped crown', tower_centers(0.60), (14, -7, -2), (1.15, 1.1, 0.9), 1.5)

bpy.ops.object.camera_add(location=(15, -42, 13))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 1, 8)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 35
camera.data.lens = 40
scene.camera = camera
scene.frame_set(1)
scene.render.filepath = str(args.output / 'frame-')
# Open newly generated scenes in camera view; choose Rendered shading to see volumes.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(args.output / 'cloud.blend'))
frame_count = 1 if args.still else settings['frames']
metadata = dict(seed=args.seed, quality=args.quality, width=settings['width'], height=settings['height'],
                frameCount=frame_count, model='procedural implicit lobes with noise erosion; not a fluid simulation')
(args.output / 'scene.json').write_text(json.dumps(metadata, indent=2) + '\n')
if args.scene_only:
    print('Scene created without rendering.', flush=True)
    sys.exit(0)
started = time.monotonic()
for frame in range(1, frame_count + 1):
    path = args.output / f'frame-{frame:04d}.png'
    if path.exists():
        print('Using cached frame', frame, flush=True)
        continue
    scene.frame_set(frame)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f'CLOUD_PROGRESS {frame}/{frame_count} elapsed={time.monotonic()-started:.1f}s', flush=True)
