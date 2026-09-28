"""Modelling helpers for the 1970s casino weapon set (Blender 4.2+ / 5.x).

Every helper takes GAME coordinates as the player sees the gun in Babylon:
x = shooter's right, y = up, z = muzzle-forward, metres.

Babylon's glTF loader converts to its left-handed scene by mirroring glTF X, so the
shooter's right is glTF -X. The glTF exporter maps Blender (x, y, z) -> glTF (x, z, -y).
A game point (x, y, z) is therefore stored in Blender at (-x, -z, y). Exports keep the
existing gun convention: receiver origin, +Y up, muzzle along +Z.
"""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
TEX = ROOT / "assets/source/weapons-1970s/textures"
CONTACTS = json.loads(Path(__file__).with_name("reference-contacts.json").read_text())
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
SERIF_PATH = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
TAU = math.tau


def B(p):
    return Vector((-p[0], -p[2], p[1]))


def G(v):
    return (-v.x, v.z, -v.y)


# ----------------------------------------------------------------------------- scene
class Ctx:
    collection = None
    mats = {}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    Ctx.mats = {}


def start(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    Ctx.collection = col
    return col


def link(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    Ctx.collection.objects.link(obj)
    return obj


# ----------------------------------------------------------------------------- materials
def _img(path, colorspace):
    key = str(path)
    for im in bpy.data.images:
        if im.filepath == key:
            return im
    im = bpy.data.images.load(key)
    im.colorspace_settings.name = colorspace
    return im


def mat(name, tex, normal=None, uv_scale=4.0, emission=None, alpha=None, normal_scale=1.0, normal_strength=1.0):
    """Principled material from assets/source/weapons-1970s/textures/<tex>.jpg + <tex>-orm.jpg."""
    if name in Ctx.mats:
        return Ctx.mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    base = nt.nodes.new("ShaderNodeTexImage")
    base.image = _img(TEX / f"{tex}.jpg", "sRGB")
    orm = nt.nodes.new("ShaderNodeTexImage")
    orm.image = _img(TEX / f"{tex}-orm.jpg", "Non-Color")
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(base.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(orm.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], p.inputs["Roughness"])
    nt.links.new(sep.outputs["Blue"], p.inputs["Metallic"])
    if normal:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = _img(TEX / f"{normal}-normal.png", "Non-Color")
        if normal_scale != 1.0:  # exported as KHR_texture_transform
            uvn = nt.nodes.new("ShaderNodeUVMap")
            mp = nt.nodes.new("ShaderNodeMapping")
            mp.vector_type = "POINT"
            mp.inputs["Scale"].default_value = (normal_scale, normal_scale, 1)
            nt.links.new(uvn.outputs["UV"], mp.inputs["Vector"])
            nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    if emission:
        p.inputs["Emission Color"].default_value = (*emission[:3], 1)
        p.inputs["Emission Strength"].default_value = emission[3] if len(emission) > 3 else 1.0
    m["uv_scale"] = uv_scale
    Ctx.mats[name] = m
    return m


def flat_mat(name, color, metal=0.0, rough=0.5, emission=0.0, alpha=1.0):
    if name in Ctx.mats:
        return Ctx.mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if emission:
        p.inputs["Emission Color"].default_value = (*color, 1)
        p.inputs["Emission Strength"].default_value = emission
    if alpha < 1.0:
        p.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except AttributeError:
            m.blend_method = "BLEND"
    m["uv_scale"] = 4.0
    Ctx.mats[name] = m
    return m


# ----------------------------------------------------------------------------- mesh core
def _obj_from_bm(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    link(o)
    if material is not None:
        me.materials.append(material)
    return o


def _recalc(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)


def finish(o, bevel=0.0, segments=2, angle=35, smooth=True, sharp=34, weighted=True):
    """Bevel, smooth-by-angle and weighted custom normals, all applied."""
    bpy.context.view_layer.objects.active = o
    if bevel > 0:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = segments
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(angle)
        b.profile = 0.6
        b.use_clamp_overlap = True
        b.harden_normals = False
    _apply_all(o)
    me = o.data
    if smooth:
        me.shade_smooth()
        try:
            me.set_sharp_from_angle(angle=math.radians(sharp))
        except AttributeError:
            pass
        if weighted:
            w = o.modifiers.new("wn", "WEIGHTED_NORMAL")
            w.keep_sharp = True
            w.weight = 50
            _apply_all(o)
    else:
        me.shade_flat()
    return o


def _apply_all(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except RuntimeError as e:
            print("modifier failed", o.name, m.name, e)
            o.modifiers.remove(m)


# ----------------------------------------------------------------------------- primitives
def box(name, center, size, material, bevel=0.002, segments=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sz, v.co.z * sy))
    for v in bm.verts:
        v.co += B(center)
    o = _obj_from_bm(name, bm, material)
    return finish(o, bevel, segments)


def prism(name, profile_zy, x0, x1, material, bevel=0.0015, segments=2, angle=35):
    """Side profile polygon (z, y) extruded across x0..x1."""
    bm = bmesh.new()
    a = [bm.verts.new(B((x0, y, z))) for z, y in profile_zy]
    b = [bm.verts.new(B((x1, y, z))) for z, y in profile_zy]
    n = len(profile_zy)
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    _recalc(bm)
    o = _obj_from_bm(name, bm, material)
    return finish(o, bevel, segments, angle)


def plate(name, profile_xz, y0, y1, material, bevel=0.001, segments=2):
    """Top-view polygon (x, z) extruded between heights y0..y1."""
    bm = bmesh.new()
    a = [bm.verts.new(B((x, y0, z))) for x, z in profile_xz]
    b = [bm.verts.new(B((x, y1, z))) for x, z in profile_xz]
    n = len(profile_xz)
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    _recalc(bm)
    return finish(_obj_from_bm(name, bm, material), bevel, segments)


def lathe(name, profile_rz, material, center=(0, 0), axis="z", segs=40, bevel=0.0, closed=False,
          start=0.0, sweep=TAU, segments=2, sharp=34, phase=0.0):
    """Surface of revolution. profile is (radius, along-axis) pairs. center = (x, y) for a z axis.
    axis 'x' spins around a line parallel to game X through (y=center[0], z=center[1]);
    axis 'y' spins around game Y through (x=center[0], z=center[1])."""
    bm = bmesh.new()
    full = abs(sweep - TAU) < 1e-6
    n = segs if full else segs + 1
    rings = []
    for r, t in profile_rz:
        ring = []
        if r <= 1e-7:
            ring = [None]
        else:
            for k in range(n):
                a = start + phase + sweep * k / segs
                ring.append((r * math.cos(a), r * math.sin(a), t))
        rings.append(ring)

    def place(p):
        u, v, t = p
        if axis == "z":
            return B((center[0] + u, center[1] + v, t))
        if axis == "x":
            return B((t, center[0] + u, center[1] + v))
        return B((center[0] + u, t, center[1] + v))

    vr = []
    for (r, t), ring in zip(profile_rz, rings):
        if ring == [None]:
            if axis == "z":
                vr.append([bm.verts.new(B((center[0], center[1], t)))])
            elif axis == "x":
                vr.append([bm.verts.new(B((t, center[0], center[1])))])
            else:
                vr.append([bm.verts.new(B((center[0], t, center[1])))])
        else:
            vr.append([bm.verts.new(place(p)) for p in ring])
    m = len(vr)
    pairs = [(i, i + 1) for i in range(m - 1)] + ([(m - 1, 0)] if closed else [])
    for i, j in pairs:
        A, Bv = vr[i], vr[j]
        if len(A) == 1 and len(Bv) == 1:
            continue
        kmax = n if full else n - 1
        for k in range(kmax):
            k2 = (k + 1) % n
            if len(A) == 1:
                bm.faces.new((A[0], Bv[k], Bv[k2]))
            elif len(Bv) == 1:
                bm.faces.new((A[k], Bv[0], A[k2]))
            else:
                bm.faces.new((A[k], Bv[k], Bv[k2], A[k2]))
    if not full:
        # cap the open sides of a partial sweep
        for idx in (0, n - 1):
            ring = [row[idx] if len(row) > 1 else row[0] for row in vr]
            uniq = []
            for v in ring:
                if not uniq or uniq[-1] is not v:
                    uniq.append(v)
            if len(set(uniq)) >= 3:
                try:
                    bm.faces.new(uniq)
                except ValueError:
                    pass
    if not closed:
        # cap open end rings (flat discs)
        for row in (vr[0], vr[-1]):
            if len(row) > 2 and full:
                bm.faces.new(row)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    _recalc(bm)
    o = _obj_from_bm(name, bm, material)
    return finish(o, bevel, segments, sharp=sharp)


def cyl(name, center, radius, length, material, axis="z", segs=32, bevel=0.0008, r2=None):
    """Cylinder centred at `center`, length along axis."""
    r2 = radius if r2 is None else r2
    x, y, z = center
    if axis == "z":
        return lathe(name, [(0, z - length / 2), (radius, z - length / 2), (r2, z + length / 2), (0, z + length / 2)],
                     material, center=(x, y), segs=segs, bevel=bevel)
    if axis == "x":
        return lathe(name, [(0, x - length / 2), (radius, x - length / 2), (r2, x + length / 2), (0, x + length / 2)],
                     material, center=(y, z), axis="x", segs=segs, bevel=bevel)
    return lathe(name, [(0, y - length / 2), (radius, y - length / 2), (r2, y + length / 2), (0, y + length / 2)],
                 material, center=(x, z), axis="y", segs=segs, bevel=bevel)


def tube(name, center, r_out, r_in, z0, z1, material, segs=40, bevel=0.0006):
    """Hollow tube (barrel with a real bore) along game Z."""
    return lathe(name, [(r_in, z0), (r_out, z0), (r_out, z1), (r_in, z1)], material,
                 center=center, segs=segs, closed=True, bevel=bevel)


# ---- sections / loft -------------------------------------------------------
def rrect(w, h, r, n=4, cx=0.0, cy=0.0):
    """Rounded rectangle, counter-clockwise, 4*(n+1) points."""
    r = min(r, w / 2 - 1e-5, h / 2 - 1e-5)
    pts = []
    for (qx, qy, a0) in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                         (w / 2 - r, -h / 2 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + qx + r * math.cos(a), cy + qy + r * math.sin(a)))
    return pts


def ellipse(w, h, n=24, cx=0.0, cy=0.0, squash=1.0):
    """Superellipse-ish section; squash>1 makes it boxier."""
    pts = []
    for k in range(n):
        a = TAU * k / n
        c, s = math.cos(a), math.sin(a)
        e = 2 / squash
        pts.append((cx + w / 2 * math.copysign(abs(c) ** e, c), cy + h / 2 * math.copysign(abs(s) ** e, s)))
    return pts


def poly(sides, r, cx=0.0, cy=0.0, phase=None):
    phase = math.pi / sides if phase is None else phase
    return [(cx + r * math.cos(phase + TAU * k / sides), cy + r * math.sin(phase + TAU * k / sides)) for k in range(sides)]


def loft(name, sections, material, bevel=0.0, cap=True, segments=2, sharp=40, along="z"):
    """sections: list of (t, [(a, b), ...]) with equal point counts.
    along 'z': points are (x, y) at z=t.  along 'y': points are (x, z) at y=t.  along 'x': (z, y) at x=t."""
    bm = bmesh.new()
    rows = []
    for t, pts in sections:
        if along == "z":
            rows.append([bm.verts.new(B((a, b, t))) for a, b in pts])
        elif along == "y":
            rows.append([bm.verts.new(B((a, t, b))) for a, b in pts])
        else:
            rows.append([bm.verts.new(B((t, b, a))) for a, b in pts])
    n = len(sections[0][1])
    for i in range(len(rows) - 1):
        A, C = rows[i], rows[i + 1]
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((A[k], A[k2], C[k2], C[k]))
    if cap:
        bm.faces.new(rows[0][::-1])
        bm.faces.new(rows[-1])
    _recalc(bm)
    o = _obj_from_bm(name, bm, material)
    return finish(o, bevel, segments, sharp=sharp)


def sweep(name, points, material, radius=0.003, height=None, segs=12, cap=True, smooth_path=4, closed=False):
    """Circular/elliptical cross-section swept along a game-space polyline (Catmull-Rom smoothed)."""
    P = [Vector(p) for p in points]
    if smooth_path and len(P) > 2:
        Q = []
        ext = ([P[-1]] + P + [P[0], P[1]]) if closed else ([P[0]] + P + [P[-1]])
        cnt = len(P) if closed else len(P) - 1
        for i in range(cnt):
            p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
            for s in range(smooth_path):
                t = s / smooth_path
                Q.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
                                (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
        if not closed:
            Q.append(P[-1])
        P = Q
    height = radius if height is None else height
    bm = bmesh.new()
    rows = []
    prev_n = None
    for i, p in enumerate(P):
        if closed:
            tan = (P[(i + 1) % len(P)] - P[i - 1]).normalized()
        else:
            tan = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        if prev_n is None:
            ref = Vector((1, 0, 0)) if abs(tan.x) < 0.9 else Vector((0, 1, 0))
            nrm = tan.cross(ref).normalized()
        else:
            nrm = (prev_n - tan * prev_n.dot(tan)).normalized()
        prev_n = nrm
        bin_ = tan.cross(nrm).normalized()
        ring = []
        for k in range(segs):
            a = TAU * k / segs
            q = p + nrm * math.cos(a) * radius + bin_ * math.sin(a) * height
            ring.append(bm.verts.new(B(tuple(q))))
        rows.append(ring)
    pairs = list(range(len(rows) - 1)) + ([len(rows) - 1] if closed else [])
    for i in pairs:
        A, C = rows[i], rows[(i + 1) % len(rows)]
        for k in range(segs):
            k2 = (k + 1) % segs
            bm.faces.new((A[k], A[k2], C[k2], C[k]))
    if cap and not closed:
        bm.faces.new(rows[0][::-1])
        bm.faces.new(rows[-1])
    _recalc(bm)
    o = _obj_from_bm(name, bm, material)
    return finish(o, 0, sharp=60)


def text(name, value, center, size, depth, material, facing="+x", font=FONT_PATH, rot=0.0, align="CENTER"):
    """Extruded text lying on a surface. facing: '+x' / '-x' (side of gun), '+y' (top), '+z'/'-z'."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = value
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.size = size
    cu.extrude = depth / 2
    cu.resolution_u = 3
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    link(o)
    o.data.materials.append(material)
    # Text is authored in Blender XY facing +Z (Blender up). Orient it.
    # Game +x (shooter's right) is Blender -X. Text on the right side reads muzzle-rightward
    # when viewed from the right: its baseline runs along Blender -Y, its face points to Blender -X.
    if facing == "+x":
        o.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    elif facing == "-x":  # left side, reads muzzle-leftward
        o.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    elif facing == "+y":  # on top, reading from breech toward muzzle
        o.rotation_euler = (0, 0, -math.pi / 2)
    elif facing == "+z":  # on a muzzle-facing surface, read from in front
        o.rotation_euler = (math.pi / 2, 0, 0)
    elif facing == "-z":  # on a rear-facing surface (butt), read from behind
        o.rotation_euler = (math.pi / 2, 0, math.pi)
    if rot:
        o.rotation_euler.rotate_axis("Z", rot)
    o.location = B(center)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.name = name
    o.data.shade_flat()
    return o


# ----------------------------------------------------------------------------- editing
def cut(target, cutters, solver="EXACT"):
    """Boolean difference; cutters are deleted."""
    cutters = cutters if isinstance(cutters, (list, tuple)) else [cutters]
    for c in cutters:
        m = target.modifiers.new("cut", "BOOLEAN")
        m.operation = "DIFFERENCE"
        m.object = c
        m.solver = solver
        _apply_all(target)
        bpy.data.objects.remove(c, do_unlink=True)
    return target


def union(target, others):
    return join(target.name, [target] + list(others))


def join(name, objs, pivot=None):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    if pivot is not None:
        set_pivot(o, pivot)
    return o


def set_pivot(o, pivot):
    """Move the object's origin to a game-space pivot without moving geometry."""
    world = o.matrix_world.copy()
    target = B(pivot)
    delta = target - world.translation
    o.data.transform(Matrix.Translation(-delta))
    o.matrix_world = Matrix.Translation(delta) @ world
    return o


def parent(child, par):
    w = child.matrix_world.copy()
    child.parent = par
    child.matrix_world = w
    return child


def mirror_x(o, name=None):
    """Duplicate mirrored across x=0 (game)."""
    c = o.copy()
    c.data = o.data.copy()
    c.name = name or (o.name + " mirror")
    link(c)
    c.data.transform(Matrix.Scale(-1, 4, Vector((1, 0, 0))))
    c.data.flip_normals()
    return c


def move(o, d):
    o.data.transform(Matrix.Translation(B(d)))
    return o


def rotate(o, axis, angle, pivot=(0, 0, 0)):
    """Rotate mesh data about a game-space axis through pivot (right-handed: +x takes +y toward +z,
    +y takes +z toward +x, +z takes +x toward +y). Game->Blender is a proper rotation, so signs carry over."""
    # C = diag-mirror mapping game->blender (det -1): R_blender = C R_game C^-1 is a rotation
    # about C(axis) by -angle.
    ax = {"x": Vector((-1, 0, 0)), "y": Vector((0, 0, 1)), "z": Vector((0, -1, 0))}[axis]
    p = B(pivot)
    M = Matrix.Translation(p) @ Matrix.Rotation(-angle, 4, ax) @ Matrix.Translation(-p)
    o.data.transform(M)
    return o


# ----------------------------------------------------------------------------- UVs
def box_uv(o, scale=None, seed=0.0):
    """Box-projection UVs; grain/brush direction runs along game Z (gun length)."""
    me = o.data
    layer = me.uv_layers[0] if len(me.uv_layers) else me.uv_layers.new(name="UVMap")
    me.uv_layers.active = layer
    uv = layer.data
    for poly in me.polygons:
        mi = poly.material_index
        m = me.materials[mi] if mi < len(me.materials) else None
        s = scale or (m.get("uv_scale", 4.0) if m else 4.0)
        n = poly.normal
        gx, gy, gz = abs(n.x), abs(n.z), abs(n.y)
        for li in poly.loop_indices:
            v = o.matrix_world @ me.vertices[me.loops[li].vertex_index].co
            x, y, z = -v.x, v.z, -v.y
            if gx >= gy and gx >= gz:
                u, w = z, y
            elif gy >= gz:
                u, w = z, x
            else:
                u, w = x, y
            uv[li].uv = (u * s + seed, w * s + seed * 0.37)


# ----------------------------------------------------------------------------- reference contacts
def contact(gun, part):
    return CONTACTS[gun][part]


def contact_hull(gun, part, inset=0.0):
    pts = contact(gun, part)["hull_zy"]
    if not inset:
        return [tuple(p) for p in pts]
    cz = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    return [(cz + (z - cz) * (1 - inset), cy + (y - cy) * (1 - inset)) for z, y in pts]


def densify(profile, step=0.006):
    out = []
    n = len(profile)
    for i in range(n):
        a, b = Vector(profile[i]), Vector(profile[(i + 1) % n])
        k = max(1, int((b - a).length / step))
        for s in range(k):
            out.append(tuple(a.lerp(b, s / k)))
    return out


def rounded_polygon(profile, radius, steps=5):
    """Fillet each corner of a 2D polygon."""
    out = []
    n = len(profile)
    for i in range(n):
        p0, p1, p2 = Vector(profile[i - 1]), Vector(profile[i]), Vector(profile[(i + 1) % n])
        d0, d1 = (p0 - p1), (p2 - p1)
        l0, l1 = d0.length, d1.length
        if l0 < 1e-6 or l1 < 1e-6:
            out.append(tuple(p1))
            continue
        r = min(radius, l0 * 0.45, l1 * 0.45)
        a = p1 + d0.normalized() * r
        c = p1 + d1.normalized() * r
        for s in range(steps + 1):
            t = s / steps
            q = (1 - t) ** 2 * a + 2 * (1 - t) * t * p1 + t * t * c
            out.append(tuple(q))
    return out


# ----------------------------------------------------------------------------- export / render
def all_objects():
    return [o for o in Ctx.collection.all_objects]


def finalize_uvs():
    for o in all_objects():
        if o.type == "MESH":
            box_uv(o, seed=(hash(o.name) % 97) / 97.0)


def export_glb(path, objects=None):
    objs = objects or all_objects()
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    kwargs = dict(filepath=str(path), export_format="GLB", use_selection=True, export_apply=True,
                  export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT",
                  export_cameras=False, export_lights=False, export_extras=False, export_animations=False,
                  export_image_format="AUTO")
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_vertex_color="NONE")
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)


def stats(objs=None):
    objs = objs or all_objects()
    tris = 0
    for o in objs:
        if o.type == "MESH":
            me = o.data
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
    return tris


def studio(target_objs, out_png, view="three", res=(1600, 1000), transparent=False, ortho_pad=1.12, lens=70,
           exposure=0.0, angle=None):
    """Neutral studio camera + area lights; renders a preview of target_objs."""
    scene = bpy.context.scene
    names = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in names else "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = transparent
    scene.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    scene.view_settings.exposure = exposure
    try:
        scene.eevee.taa_render_samples = 64
    except AttributeError:
        pass
    if not scene.world:
        w = bpy.data.worlds.new("Studio")
        scene.world = w
        w.use_nodes = True
        bg = w.node_tree.nodes["Background"]
        bg.inputs[0].default_value = (0.05, 0.052, 0.058, 1)
        bg.inputs[1].default_value = 1.0
    rig = bpy.data.collections.get("Studio rig") or bpy.data.collections.new("Studio rig")
    if rig.name not in scene.collection.children:
        scene.collection.children.link(rig)
    for o in list(rig.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    pts = [o.matrix_world @ Vector(c) for o in target_objs if o.type == "MESH" for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    center, size = (lo + hi) / 2, (hi - lo).length

    def light(name, loc, energy, sz, color):
        d = bpy.data.lights.new(name, "AREA")
        d.energy = energy * size * size * 6
        d.size = sz * size
        d.color = color
        o = bpy.data.objects.new(name, d)
        rig.objects.link(o)
        o.location = center + Vector(loc) * size
        o.rotation_euler = (center - o.location).to_track_quat("-Z", "Y").to_euler()

    light("Key", (-0.9, -0.8, 1.1), 55, 0.9, (1, 0.94, 0.85))
    light("Fill", (1.1, -0.5, 0.35), 18, 1.4, (0.78, 0.86, 1))
    light("Rim", (0.2, 1.2, 0.8), 45, 0.6, (1, 0.9, 0.75))
    light("Floor bounce", (-0.2, -0.3, -1.2), 8, 1.4, (1, 0.85, 0.7))
    cam = bpy.data.objects.new("Studio camera", bpy.data.cameras.new("Studio camera"))
    rig.objects.link(cam)
    scene.camera = cam
    if view == "side":
        cam.data.type = "ORTHO"
        ext_len, ext_h = hi.y - lo.y, hi.z - lo.z
        aspect = res[0] / res[1]
        cam.data.ortho_scale = max(ext_len, ext_h * aspect) * ortho_pad
        cam.location = center + Vector((-size * 2, 0, 0))
        cam.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
        cam.data.clip_end = size * 10
    else:
        d = Vector(angle or (-1.0, -0.8, 0.45)).normalized()
        cam.data.lens = lens
        dist = size * 1.9 * lens / 50
        cam.location = center + d * dist
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.clip_end = dist * 10
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 86
    scene.render.filepath = str(out_png).replace(".png", ".jpg")
    bpy.ops.render.render(write_still=True)
    return cam
