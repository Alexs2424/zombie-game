"""Build the 1970s Mystery Box arsenal in Blender (docs/weapon-spec-1970s.md).

  /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/weapon-1970s/build_weapons.py -- [ids...]

For every weapon id this script builds a fresh scene with a collection named after
the weapon, a neutral studio rig and camera, exports public/models/<id>.glb, saves the
source to assets/source/weapons-1970s/<id>.blend and renders previews into
docs/weapon-1970s-assets/. Game/glTF convention: metres, +Y up, muzzle along +Z,
origin at the receiver. Animated parts are separate named nodes whose origins sit on
their real pivots (hinges, crane, hammer, lever, bolt axis ...).
"""
import sys, math, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from wlib import *  # noqa: F401,F403
import wlib

OUT = ROOT / "public/models"
SRC = ROOT / "assets/source/weapons-1970s"
DOC = ROOT / "docs/weapon-1970s-assets"
DOC.mkdir(parents=True, exist_ok=True)
SRC.mkdir(parents=True, exist_ok=True)
BUILDERS = {}


def weapon(wid):
    def reg(fn):
        BUILDERS[wid] = fn
        return fn
    return reg


# ----------------------------------------------------------------------------- shared materials
def M():
    return {
        "blued": mat("Blued steel", "blued"),
        "nickel": mat("Nickel steel", "nickel"),
        "park": mat("Parkerized steel", "parkerized"),
        "black": mat("Blackened steel", "blackened"),
        "gun": mat("Stamped gunmetal", "gunmetal"),
        "brass": mat("Aged brass", "brass"),
        "silver": mat("Silver inlay", "silver", uv_scale=10),
        "walnut": mat("Walnut", "walnut", uv_scale=4.5),
        "walnut_dark": mat("Dark walnut", "walnut-dark", uv_scale=4.5),
        "checker": mat("Checkered walnut", "walnut-dark", normal="checker", uv_scale=3.2, normal_scale=4.5, normal_strength=0.55),
        "bakelite": mat("Bakelite", "bakelite", uv_scale=6),
        "bakelite_rib": mat("Checkered Bakelite", "bakelite", normal="checker", uv_scale=6, normal_scale=2.2, normal_strength=0.35),
        "pearl": mat("Pearl grip", "pearl", uv_scale=8),
        "ivory": mat("Ivory grip", "ivory", uv_scale=8),
        "rubber": mat("Oxblood rubber", "rubber-oxblood", uv_scale=6),
        "leather": mat("Oxblood leather", "leather-oxblood", uv_scale=5),
        "forged": mat("Forged black steel", "forged"),
        "red": mat("Fire red paint", "red-paint"),
        "olive": mat("Olive drab paint", "olive-paint"),
        "label": mat("Safety yellow label", "yellow-label", uv_scale=8),
        "hickory": mat("Hickory", "hickory", uv_scale=3.2),
        "bore": flat_mat("Bore black", (0.01, 0.01, 0.01), 0.6, 0.6),
        "sight_red": flat_mat("Red sight insert", (0.7, 0.05, 0.03), 0.0, 0.35),
        "sight_white": flat_mat("Ivory sight bead", (0.92, 0.88, 0.76), 0.0, 0.35),
        "glass": flat_mat("Scope glass", (0.05, 0.09, 0.1), 0.2, 0.05),
        "copper": mat("Copper bullet", "brass", uv_scale=12),
        "paper_red": flat_mat("Red shell hull", (0.42, 0.04, 0.04), 0.0, 0.55),
        "paper_green": flat_mat("Green shell hull", (0.05, 0.22, 0.12), 0.0, 0.55),
        "stencil": flat_mat("Stencil paint", (0.82, 0.78, 0.62), 0.0, 0.7),
    }


def cartridge(name, base_z, length, r_case, r_bullet, m, rim=0.0006, bullet_len=None, neck=None, center=(0, 0),
              nose="round", segs=18):
    """Pistol/rifle cartridge along +Z from base_z. Returns (case, bullet)."""
    bl = bullet_len or length * 0.35
    cz = length - bl * 0.55
    neck = neck or r_bullet * 1.08
    prof = [(0, base_z), (r_case + rim, base_z), (r_case + rim, base_z + 0.0012), (r_case * 0.94, base_z + 0.0016),
            (r_case * 0.94, base_z + 0.0028), (r_case, base_z + 0.0032), (r_case * 0.98, base_z + cz * 0.8)]
    if neck < r_case * 0.95:
        prof += [(neck, base_z + cz * 0.9), (neck, base_z + cz)]
    else:
        prof += [(r_case * 0.97, base_z + cz)]
    prof += [(0, base_z + cz)]
    case = lathe(name + " case", prof, m["brass"], center=center, segs=segs)
    tip = base_z + length
    if nose == "flat":
        bp = [(0, base_z + cz - 0.003), (r_bullet, base_z + cz - 0.003), (r_bullet, tip - bl * 0.35),
              (r_bullet * 0.55, tip - 0.0005), (0, tip)]
    elif nose == "spitzer":
        bp = [(0, base_z + cz - 0.003), (r_bullet, base_z + cz - 0.003), (r_bullet, tip - bl * 0.6),
              (r_bullet * 0.7, tip - bl * 0.3), (r_bullet * 0.2, tip - 0.001), (0, tip)]
    else:
        bp = [(0, base_z + cz - 0.003), (r_bullet, base_z + cz - 0.003), (r_bullet, tip - bl * 0.45),
              (r_bullet * 0.8, tip - bl * 0.2), (r_bullet * 0.35, tip - 0.0007), (0, tip)]
    bullet = lathe(name + " bullet", bp, m["copper"], center=center, segs=segs)
    return case, bullet


def shotshell(name, base_z, length, r, m, hull="paper_red", center=(0, 0), axis="z", segs=24):
    brass_len = 0.012
    prof_b = [(0, base_z), (r + 0.0009, base_z), (r + 0.0009, base_z + 0.0012), (r + 0.0002, base_z + 0.0016),
              (r + 0.0002, base_z + brass_len), (0, base_z + brass_len)]
    head = lathe(name + " brass head", prof_b, m["brass"], center=center, segs=segs, axis=axis)
    prof_h = [(0, base_z + brass_len - 0.001), (r, base_z + brass_len - 0.001), (r, base_z + length - 0.002),
              (r * 0.8, base_z + length), (0, base_z + length - 0.0015)]
    hull_o = lathe(name + " hull", prof_h, m[hull], center=center, segs=segs, axis=axis)
    primer = lathe(name + " primer", [(0, base_z - 0.0003), (r * 0.22, base_z - 0.0003), (r * 0.22, base_z + 0.0005), (0, base_z + 0.0005)],
                   m["silver"], center=center, segs=12, axis=axis)
    return join(name, [head, hull_o, primer])


def screw(name, pos, r, m, axis="x", depth=0.0012):
    x, y, z = pos
    s = cyl(name, pos, r, depth, m, axis=axis, segs=14, bevel=r * 0.25)
    slot_len = r * 2.2
    if axis == "x":
        slot = box(name + " slot", (x + math.copysign(depth / 2, x or 1), y, z), (depth * 0.8, r * 0.35, slot_len), m, bevel=0)
    elif axis == "y":
        slot = box(name + " slot", (x, y + depth / 2, z), (r * 0.35, depth * 0.8, slot_len), m, bevel=0)
    else:
        slot = box(name + " slot", (x, y, z + depth / 2), (slot_len, r * 0.35, depth * 0.8), m, bevel=0)
    return cut(s, slot)


def suits(prefix, center, size, m, facing="+x", spacing=None):
    return text(prefix + " suit engraving", "♠♥♦♣", center, size, 0.00035, m, facing=facing)


def grip_panels(name, gun_ref, part, half_width, m_panel, inset=0.0, fillet=0.012, bevel=0.004):
    prof = rounded_polygon(contact_hull(gun_ref, part, inset), fillet)
    return prism(name, prof, -half_width, half_width, m_panel, bevel=bevel, segments=3, angle=25)


# ============================================================================= shared pieces
def hull_edges(gun, part):
    """Return (back(y), front(y)) z-interpolators for a grip hull, plus its y range."""
    pts = contact_hull(gun, part)
    ys = [p[1] for p in pts]
    lo, hi = min(ys), max(ys)

    def edge(y, pick):
        zs = []
        n = len(pts)
        for i in range(n):
            (z0, y0), (z1, y1) = pts[i], pts[(i + 1) % n]
            if (y0 - y) * (y1 - y) <= 0 and abs(y1 - y0) > 1e-9:
                zs.append(z0 + (z1 - z0) * (y - y0) / (y1 - y0))
        return pick(zs) if zs else None
    return (lambda y: edge(y, min)), (lambda y: edge(y, max)), lo, hi


def grip_loft(name, gun, part, half_w, material, y0=None, y1=None, shrink_front=0.0, shrink_back=0.0, squash=1.7,
              steps=14, extend_top=0.0, bottom_round=0.004):
    """Organic grip: horizontal rounded sections following a reference hand-contact envelope."""
    back, front, lo, hi = hull_edges(gun, part)
    y0 = lo + 0.002 if y0 is None else y0
    y1 = hi - 0.002 if y1 is None else y1
    secs = []
    for i in range(steps + 1):
        y = y0 + (y1 - y0) * i / steps
        zb, zf = back(y), front(y)
        if zb is None or zf is None:
            continue
        zb += shrink_back
        zf -= shrink_front
        secs.append((y, rrect(half_w * 2, zf - zb, min(half_w * 0.85, (zf - zb) * 0.3), 6, 0, (zb + zf) / 2)))
    if bottom_round:
        y, _ = secs[0]
        zb, zf = back(y) + shrink_back, front(y) - shrink_front
        d = zf - zb
        r = min(half_w * 0.85, d * 0.3)
        secs.insert(0, (y - bottom_round * 0.6, rrect(half_w * 2 - bottom_round * 0.8, d - bottom_round * 0.8, r * 0.9, 6, 0, (zb + zf) / 2)))
        secs.insert(0, (y - bottom_round, rrect(half_w * 2 - bottom_round * 2.2, d - bottom_round * 2.2, r * 0.7, 6, 0, (zb + zf) / 2)))
    if extend_top:
        y, pts = secs[-1]
        secs.append((y + extend_top, pts))
    return loft(name, secs, material, along="y", bevel=0, sharp=60)


def band(name, outer, inner, x0, x1, material, bevel=0.0008):
    o = prism(name, outer, x0, x1, material, bevel=bevel)
    i = prism(name + " cut", inner, x0 - 0.01, x1 + 0.01, material, bevel=0)
    return cut(o, i)


def offset_poly(poly, d):
    """Crude inward/outward offset of a convex-ish polygon about its centroid-normal."""
    n = len(poly)
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(poly[i - 1]), Vector(poly[i]), Vector(poly[(i + 1) % n])
        e0 = (p1 - p0).normalized()
        e1 = (p2 - p1).normalized()
        n0 = Vector((e0.y, -e0.x))
        n1 = Vector((e1.y, -e1.x))
        nn = (n0 + n1)
        if nn.length < 1e-6:
            nn = n0
        nn.normalize()
        cosh = max(0.3, nn.dot(n0))
        out.append(tuple(p1 + nn * d / cosh))
    return out


# ============================================================================= HIGH ROLLER
@weapon("magnum")
def magnum():
    m = M()
    fin = m["nickel"]
    bore_y, cyl_y = 0.052, 0.0385
    # --- frame: top strap, recoil shield, hammer hump; cylinder window cut through
    gback, gfront, glo, ghi = hull_edges("pistol", "Grip frame")
    frame_prof = rounded_polygon([
        (gback(glo + 0.012) + 0.001, glo + 0.012), (gback(-0.03), -0.03), (-0.083, 0.004), (-0.074, 0.026), (-0.058, 0.046),
        (-0.036, 0.061), (-0.012, 0.0695),
        (0.056, 0.0695), (0.064, 0.064), (0.065, 0.024), (0.054, 0.013), (0.045, 0.009),
        (0.036, -0.012), (-0.008, -0.012), (gfront(-0.03), -0.03), (gfront(glo + 0.012) - 0.001, glo + 0.012)], 0.0065)
    frame = prism("Frame body", frame_prof, -0.0165, 0.0165, fin, bevel=0.0024, segments=3)
    # the grip strap region is narrower than the cylinder frame
    for side in (1, -1):
        slab = prism("strap relief", [(gback(-0.02) - 0.02, -0.2), (0.02, -0.2), (0.02, -0.014), (gback(-0.02) - 0.02, -0.014)],
                     side * 0.0115, side * 0.03, fin, bevel=0)
        frame = cut(frame, slab)
    window = box("cyl window", (0, 0.0385, 0.0185), (0.06, 0.047, 0.0452), fin, bevel=0)
    groove = box("groove", (0, 0.071, 0.02), (0.0032, 0.004, 0.075), fin, bevel=0)
    hammer_slot = box("hammer slot", (0, 0.05, -0.03), (0.0095, 0.05, 0.03), fin, bevel=0)
    frame = cut(frame, [window, groove, hammer_slot])
    # narrow steel grip frame: front strap / backstrap visible between the stocks
    back, front, lo, hi = hull_edges("pistol", "Grip frame")
    recoil_ring = lathe("Recoil shield", [(0.0165, -0.0075), (0.0225, -0.0075), (0.0225, -0.0045), (0.0165, -0.0045)], fin,
                        center=(0, cyl_y), segs=48, closed=True, bevel=0.0006, start=math.radians(200), sweep=math.radians(140))
    screws = [screw(f"Side plate screw {i}", (0.0168, y, z), 0.0023, fin) for i, (y, z) in enumerate([(0.03, -0.042), (0.0, 0.012), (-0.002, -0.05)])]
    suit = suits("High Roller", (0.0168, 0.016, -0.026), 0.0078, m["silver"])
    latch = prism("Cylinder latch", rounded_polygon([(-0.026, 0.024), (-0.006, 0.025), (-0.004, 0.036), (-0.026, 0.036)], 0.003),
                  -0.0205, -0.0165, fin, bevel=0.0008)
    latch_ribs = [box(f"latch rib {i}", (-0.0207, 0.03, -0.023 + i * 0.0035), (0.0006, 0.009, 0.0012), fin, bevel=0) for i in range(5)]
    rsight = prism("Rear sight", [(-0.02, 0.0695), (0.002, 0.0695), (0.0, 0.0765), (-0.016, 0.0765)], -0.0055, 0.0055, m["black"], bevel=0.0006)
    notch = box("notch", (0, 0.076, -0.008), (0.0028, 0.006, 0.03), fin, bevel=0)
    rsight = cut(rsight, notch)
    elev = cyl("Rear sight elevation screw", (0, 0.0768, -0.002), 0.0016, 0.0012, fin, axis="y", segs=12)
    frame_all = join("Frame", [frame, recoil_ring, *screws, suit, latch, *latch_ribs, rsight, elev])
    # --- checkered walnut target stocks + brass house plaque (right stock)
    stocks = grip_loft("Grip stocks", "pistol", "Grip frame", 0.0225, m["checker"], y0=-0.148, y1=-0.012, shrink_front=0.004,
                       shrink_back=0.005, squash=1.55, extend_top=0.012)
    plaque = lathe("House plaque", [(0, 0.0), (0.0068, 0.0), (0.0062, 0.0012), (0, 0.0014)], m["brass"], center=(-0.048, -0.074), axis="x", segs=28)
    move(plaque, (0.0216, 0, 0))
    plaque_mark = text("Plaque mark", "♠", (0.0232, -0.048, -0.074), 0.0075, 0.0003, m["walnut_dark"], facing="+x")
    grip_screw = screw("Grip screw", (0.0232, -0.095, -0.07), 0.0027, m["nickel"])
    grips = join("Grip", [stocks, plaque, plaque_mark, grip_screw])
    # --- barrel: heavy 6-inch with vent rib and full underlug
    barrel = tube("Barrel tube", (0, bore_y), 0.0098, 0.0046, 0.058, 0.204, fin, segs=40)
    shank = lathe("Barrel shank", [(0.0046, 0.041), (0.0104, 0.041), (0.0104, 0.066), (0.0046, 0.066)], fin, center=(0, bore_y), closed=True, segs=40)
    crown = lathe("Muzzle crown", [(0.0046, 0.2035), (0.0098, 0.2035), (0.0088, 0.2055), (0.0052, 0.2055)], fin, center=(0, bore_y), closed=True, segs=40)
    rib = prism("Vent rib", [(0.058, 0.0605), (0.2035, 0.0605), (0.2035, 0.0655), (0.2, 0.0668), (0.062, 0.0668)], -0.0056, 0.0056, fin, bevel=0.0006)
    vents = [box(f"vent {i}", (0, 0.0634, 0.077 + i * 0.0165), (0.02, 0.0028, 0.0095), fin, bevel=0) for i in range(8)]
    rib = cut(rib, vents)
    lug = loft("Underlug", [(z, rrect(0.0165, 0.029, 0.0078, 4, 0, 0.0415)) for z in (0.0585, 0.2035)], fin, bevel=0.0012)
    lug = cut(lug, cyl("ejector channel", (0, cyl_y, 0.077), 0.0036, 0.042, fin))
    fsight = prism("Front sight", [(0.17, 0.0665), (0.2, 0.0665), (0.2, 0.079), (0.195, 0.08), (0.176, 0.0695)], -0.0016, 0.0016, fin, bevel=0.0003)
    insert = prism("Front sight insert", [(0.19, 0.0728), (0.1985, 0.0728), (0.1985, 0.0785), (0.194, 0.0792)], -0.0017, 0.0017, m["sight_red"], bevel=0)
    bore = cyl("Bore shadow", (0, bore_y, 0.19), 0.0045, 0.03, m["bore"], segs=20)
    rollmark = text("Barrel rollmark", "HIGH ROLLER · .357 · HOUSE", (0.00985, bore_y, 0.13), 0.0047, 0.0002, m["black"], facing="+x")
    barrel_all = join("Barrel", [barrel, shank, crown, rib, lug, fsight, insert, bore, rollmark])
    # --- hammer and trigger on their pivots
    hpiv = (0, 0.036, -0.026)
    hammer = prism("Hammer body", rounded_polygon([(-0.031, 0.03), (-0.02, 0.03), (-0.017, 0.05), (-0.022, 0.062), (-0.034, 0.068),
                                                   (-0.044, 0.0685), (-0.042, 0.0625), (-0.034, 0.056), (-0.031, 0.042)], 0.0025),
                   -0.0042, 0.0042, fin, bevel=0.0007)
    spur_chk = [box(f"spur check {i}", (0, 0.068 - i * 0.0005, -0.0415 + i * 0.0032), (0.0086, 0.0012, 0.0011), m["black"], bevel=0) for i in range(4)]
    hammer = join("Hammer", [hammer, *spur_chk], pivot=hpiv)
    tpiv = (0, -0.008, 0.022)
    trig = prism("Trigger blade", rounded_polygon([(0.017, -0.006), (0.025, -0.006), (0.028, -0.026), (0.024, -0.042), (0.017, -0.05),
                                                   (0.013, -0.047), (0.018, -0.036), (0.019, -0.022)], 0.002), -0.0052, 0.0052, fin, bevel=0.0009)
    trig_grooves = [box(f"trigger groove {i}", (0, -0.018 - i * 0.004, 0.0265 - i * 0.0004), (0.0108, 0.0009, 0.002), m["black"], bevel=0) for i in range(5)]
    trigger = join("Trigger", [trig, *trig_grooves], pivot=tpiv)
    g_out = rounded_polygon([(-0.013, -0.008), (-0.011, -0.046), (0.004, -0.06), (0.042, -0.062), (0.064, -0.05), (0.07, -0.028), (0.064, -0.008)], 0.012)
    g_in = rounded_polygon([(-0.007, -0.008), (-0.006, -0.043), (0.006, -0.0545), (0.04, -0.0565), (0.058, -0.047), (0.063, -0.028), (0.058, -0.004)], 0.01)
    guard = join("Trigger guard", [band("guard band", g_out, g_in, -0.0052, 0.0052, fin)])
    # --- crane / cylinder / cartridges / ejector
    crane_piv = (-0.0115, 0.0175, 0.0)
    cyl_len, cz0 = 0.0435, -0.0035
    cz1 = cz0 + cyl_len
    body = lathe("Cylinder body", [(0.0055, cz0), (0.0195, cz0), (0.0211, cz0 + 0.0015), (0.0211, cz1 - 0.0015),
                                    (0.0196, cz1), (0.0055, cz1)], fin, center=(0, cyl_y), segs=64, closed=True, bevel=0.0004)
    flutes, chambers, rounds, stops = [], [], [], []
    for k in range(6):
        a = math.pi / 2 + k * TAU / 6
        fa = a + TAU / 12
        fx, fy = math.cos(fa) * 0.0235, cyl_y + math.sin(fa) * 0.0235
        flutes.append(lathe(f"flute {k}", [(0, cz0 + 0.009), (0.0052, cz0 + 0.0125), (0.0052, cz1 - 0.0055), (0, cz1 - 0.002)], fin, center=(fx, fy), segs=16))
        cx, cy2 = math.cos(a) * 0.0135, cyl_y + math.sin(a) * 0.0135
        chambers.append(cyl(f"chamber {k}", (cx, cy2, (cz0 + cz1) / 2), 0.0049, cyl_len + 0.01, fin, segs=18))
        sx, sy = math.cos(fa) * 0.0205, cyl_y + math.sin(fa) * 0.0205
        stops.append(box(f"stop notch {k}", (sx, sy, cz0 + 0.0075), (0.0035, 0.0035, 0.004), fin, bevel=0))
        case, bullet = cartridge(f"Round {k}", cz0 - 0.0006, 0.0395, 0.0048, 0.0045, m, rim=0.0007, bullet_len=0.012, center=(cx, cy2), nose="flat")
        rounds += [case, bullet]
    body = cut(body, flutes + chambers + stops)
    ratchet = lathe("Ejector star", [(0.0028, cz0 - 0.0012), (0.0078, cz0 - 0.0012), (0.0078, cz0 + 0.0003), (0.0028, cz0 + 0.0003)],
                    fin, center=(0, cyl_y), segs=6, closed=True, phase=math.pi / 6)
    cylinder = join("Cylinder", [body, ratchet], pivot=(0, cyl_y, 0.0185))
    cartridges = join("Cartridges", rounds, pivot=(0, cyl_y, 0.0185))
    rod = join("Ejector rod", [cyl("rod", (0, cyl_y, cz1 + 0.024), 0.0026, 0.048, fin, segs=16),
                               lathe("rod head", [(0, cz1 + 0.046), (0.0033, cz1 + 0.046), (0.0033, cz1 + 0.052), (0.0024, cz1 + 0.0535), (0, cz1 + 0.0535)],
                                     fin, center=(0, cyl_y), segs=16)], pivot=(0, cyl_y, cz1))
    yoke = join("Crane", [
        sweep("crane arm", [(crane_piv[0], crane_piv[1], cz1 + 0.0016), (-0.006, 0.026, cz1 + 0.0016), (0, cyl_y, cz1 + 0.0016)], fin,
              radius=0.0045, height=0.0028, segs=10),
        cyl("crane barrel", (crane_piv[0], crane_piv[1], cz1 - 0.02), 0.0032, 0.042, fin, segs=16),
    ], pivot=crane_piv)
    parent(cylinder, yoke); parent(cartridges, cylinder); parent(rod, yoke)
    return {"muzzle": (0, bore_y, 0.206), "hands": "pistol", "class": "revolver",
            "animated": ["Hammer", "Trigger", "Crane", "Cylinder", "Cartridges", "Ejector rod"],
            "pivots": {"Crane": crane_piv, "Cylinder": (0, cyl_y, 0.0185), "Hammer": hpiv, "Trigger": tpiv},
            "chambers": 6}


# ============================================================================= SNAKE EYES
def pocket_pistol(prefix, m, variant):
    """Compact .25/.32-style pocket pistol, grip on the House Special hand envelope but a short frame."""
    fin = m["nickel"] if variant == "right" else m["blued"]
    grip_mat = m["pearl"] if variant == "right" else m["bakelite_rib"]
    bore_y = 0.02
    back, front, lo, hi = hull_edges("pistol", "Grip frame")
    gy0 = -0.112  # short pocket-pistol grip; the little finger rides under it
    # frame + dust cover
    fr = rounded_polygon([(back(-0.012), -0.012), (-0.078, 0.004), (0.056, 0.004), (0.058, -0.004), (0.046, -0.01), (0.008, -0.012),
                          (front(-0.03), -0.03), (front(gy0), gy0), (back(gy0) + 0.006, gy0), (back(-0.05), -0.05)], 0.005)
    frame = prism(prefix + " frame", fr, -0.0105, 0.0105, fin, bevel=0.0018, segments=3)
    # grips: short panels over the upper envelope
    panels = grip_loft(prefix + " grips", "pistol", "Grip frame", 0.0165 if variant == "right" else 0.0175, grip_mat,
                       y0=gy0 + 0.006, y1=-0.016, shrink_front=0.006, shrink_back=0.006, steps=10)
    mag_base = prism(prefix + " magazine base", rounded_polygon([(back(gy0) + 0.004, gy0 + 0.001), (front(gy0) - 0.001, gy0 + 0.001),
                                                                 (front(gy0) + 0.002, gy0 - 0.007), (back(gy0) + 0.002, gy0 - 0.007)], 0.003),
                     -0.011, 0.011, m["black"] if variant == "left" else m["nickel"], bevel=0.0012)
    g_out = rounded_polygon([(-0.004, -0.006), (-0.003, -0.036), (0.012, -0.046), (0.042, -0.044), (0.05, -0.02), (0.046, -0.004)], 0.012)
    g_in = rounded_polygon([(0.001, -0.004), (0.002, -0.032), (0.013, -0.04), (0.038, -0.039), (0.044, -0.02), (0.041, 0.0)], 0.009)
    guard = band(prefix + " trigger guard", g_out, g_in, -0.0045, 0.0045, fin)
    parts = [frame, panels, guard]
    if variant == "right":
        inlay = text(prefix + " inlay", "♦", (0.0168, -0.058, -0.066), 0.011, 0.0004, m["brass"], facing="+x")
        inlay2 = text(prefix + " inlay L", "♦", (-0.0168, -0.058, -0.066), 0.011, 0.0004, m["brass"], facing="-x")
        parts += [inlay, inlay2]
    else:
        med = lathe(prefix + " medallion", [(0, 0.0), (0.0055, 0.0), (0.005, 0.001), (0, 0.0012)], m["brass"], center=(-0.06, -0.065), axis="x", segs=20)
        move(med, (0.0174, 0, 0))
        parts.append(med)
    screw_r = screw(prefix + " grip screw", (0.0172 if variant == "left" else 0.0165, -0.085, -0.07), 0.0022, fin)
    parts.append(screw_r)
    frame_all = join(prefix + " frame", parts)
    # slide (moving) with serrations, ejection port, sights
    if variant == "right":
        sprof = rounded_polygon([(-0.086, 0.004), (0.074, 0.004), (0.076, 0.024), (0.07, 0.034), (-0.08, 0.034), (-0.086, 0.026)], 0.004)
        slide = prism(prefix + " slide body", sprof, -0.0108, 0.0108, fin, bevel=0.0018, segments=3)
        port = box("port", (0.012, 0.03, 0.0), (0.012, 0.012, 0.026), fin, bevel=0)
        bore = cyl("bore", (0, bore_y, 0.07), 0.0034, 0.02, fin)
        slide = cut(slide, [port, bore])
        serr = [box(f"serration {i}", (0.0112 * s, 0.019, -0.074 + i * 0.0038), (0.0012, 0.022, 0.0014), m["black"], bevel=0)
                for i in range(6) for s in (1, -1)]
        hammer = prism(prefix + " hammer spur", rounded_polygon([(-0.092, 0.014), (-0.084, 0.014), (-0.084, 0.03), (-0.094, 0.034), (-0.097, 0.03)], 0.002),
                       -0.004, 0.004, fin, bevel=0.0006)
        hammer = join(prefix + " Hammer", [hammer], pivot=(0, 0.012, -0.086))
        mark = text(prefix + " slide mark", "SNAKE EYES · .25", (0.0109, 0.019, 0.012), 0.0038, 0.0002, m["black"], facing="+x")
        extra = [*serr, mark]
    else:
        # open-top slide exposing the barrel, rounded hammerless rear
        sprof = rounded_polygon([(-0.09, 0.004), (0.082, 0.004), (0.084, 0.02), (0.07, 0.026), (0.04, 0.026), (0.03, 0.034),
                                 (-0.084, 0.034), (-0.092, 0.022)], 0.004)
        slide = prism(prefix + " slide body", sprof, -0.011, 0.011, fin, bevel=0.0018, segments=3)
        top_cut = box("open top", (0, 0.03, 0.012), (0.012, 0.012, 0.056), fin, bevel=0)
        bore = cyl("bore", (0, bore_y, 0.075), 0.0036, 0.03, fin)
        slide = cut(slide, [top_cut, bore])
        barrel_top = cyl(prefix + " exposed barrel", (0, bore_y + 0.001, 0.02), 0.0058, 0.1, fin, segs=24)
        serr = [box(f"serration {i}", (0.0114 * s, 0.019, -0.08 + i * 0.0036), (0.0012, 0.022, 0.0014), m["black"], bevel=0)
                for i in range(7) for s in (1, -1)]
        mark = text(prefix + " slide mark", "SNAKE EYES · .32", (-0.0112, 0.014, 0.0), 0.0038, 0.0002, m["silver"], facing="-x")
        extra = [*serr, mark, barrel_top]
        hammer = None
    fs = box(prefix + " front sight", (0, 0.036, 0.066), (0.003, 0.004, 0.006), fin, bevel=0.0005)
    rs = prism(prefix + " rear sight", [(-0.078, 0.034), (-0.066, 0.034), (-0.068, 0.0385), (-0.076, 0.0385)], -0.0055, 0.0055, fin, bevel=0.0004)
    rs = cut(rs, box("notch", (0, 0.038, -0.072), (0.002, 0.004, 0.02), fin, bevel=0))
    slide_all = join(prefix + " Slide", [slide, fs, rs, *extra], pivot=(0, bore_y, 0.0))
    tpiv = (0, -0.006, 0.02)
    trig = prism(prefix + " trigger", rounded_polygon([(0.016, -0.004), (0.022, -0.004), (0.024, -0.02), (0.019, -0.034), (0.014, -0.036),
                                                       (0.016, -0.024), (0.016, -0.012)], 0.0018), -0.0035, 0.0035, fin, bevel=0.0007)
    trigger = join(prefix + " Trigger", [trig], pivot=tpiv)
    # magazine (drops on reload), mostly hidden inside the grip
    mag = prism(prefix + " mag body", rounded_polygon([(back(-0.02) + 0.012, -0.018), (front(-0.02) - 0.012, -0.018),
                                                       (front(gy0) - 0.006, gy0 + 0.002), (back(gy0) + 0.012, gy0 + 0.002)], 0.002),
                -0.0075, 0.0075, m["blued"], bevel=0.0005)
    magazine = join(prefix + " Magazine", [mag, mag_base], pivot=(0, gy0, -0.07))
    root = join(prefix + " pistol", [frame_all], pivot=(0, 0, 0))
    for c in (slide_all, trigger, magazine) + ((hammer,) if hammer else ()):
        parent(c, root)
    return root


@weapon("dual")
def dual():
    m = M()
    right = pocket_pistol("Right", m, "right")
    left = pocket_pistol("Left", m, "left")
    left.location.x += 0.11  # Blender +X is the shooter's left; display pair side by side
    return {"muzzle": (0, 0.02, 0.078), "hands": "pistol (right hand, mirrored for the left pistol)", "class": "twin pocket pistols",
            "animated": ["Right pistol", "Right Slide", "Right Trigger", "Right Hammer", "Right Magazine",
                         "Left pistol", "Left Slide", "Left Trigger", "Left Magazine"],
            "note": "Both pistols share the origin. The runtime mirrors a second right hand and offsets the Left pistol to the shooter's left."}


# ============================================================================= THE ENFORCER
@weapon("machinepistol")
def machinepistol():
    m = M()
    fin = m["gun"]
    bore_y = 0.028
    back, front, lo, hi = hull_edges("pistol", "Grip frame")
    # slab-sided stamped receiver
    rec = rounded_polygon([(-0.1, -0.012), (-0.1, 0.046), (0.105, 0.046), (0.108, 0.04), (0.108, 0.004), (0.098, -0.012)], 0.003)
    receiver = prism("Receiver shell", rec, -0.019, 0.019, fin, bevel=0.0012, segments=2)
    port = box("ejection port", (0.02, 0.03, 0.02), (0.02, 0.014, 0.034), fin, bevel=0)
    slot = box("bolt slot", (0, 0.047, -0.02), (0.006, 0.01, 0.1), fin, bevel=0)
    receiver = cut(receiver, [port, slot])
    seam = [box(f"stamp seam {s}", (0.0192 * s, 0.017, 0.004), (0.0006, 0.0012, 0.2), m["black"], bevel=0) for s in (1, -1)]
    rivets = [cyl(f"rivet {i}", (0.0192 * s, y, z), 0.0017, 0.0012, fin, axis="x", segs=10) for i, (y, z) in enumerate([(0.006, -0.08), (0.006, 0.08), (0.036, 0.09), (0.036, -0.088)]) for s in (1, -1)]
    lower = prism("Lower frame", rounded_polygon([(-0.1, -0.012), (0.07, -0.012), (0.066, -0.02), (-0.096, -0.02)], 0.003), -0.016, 0.016, fin, bevel=0.001)
    selector = prism("Selector lever", rounded_polygon([(-0.052, 0.0), (-0.034, 0.004), (-0.036, 0.01), (-0.054, 0.008)], 0.002), -0.0215, -0.0192, m["black"], bevel=0.0005)
    sel_marks = [text("Selector S", "S", (-0.0194, -0.006, -0.058), 0.004, 0.0002, m["stencil"], facing="-x"),
                 text("Selector A", "A", (-0.0194, 0.012, -0.03), 0.004, 0.0002, m["stencil"], facing="-x")]
    stamp = text("Receiver stamp", "THE ENFORCER · CAL 9 · HOUSE 07", (0.0194, 0.03, -0.035), 0.0042, 0.00022, m["stencil"], facing="+x")
    # front: short barrel with stamped nut
    barrel = tube("Barrel", (0, bore_y), 0.0072, 0.0045, 0.1, 0.16, m["blued"], segs=28)
    nut = lathe("Barrel nut", [(0.0045, 0.104), (0.0105, 0.104), (0.0105, 0.118), (0.0045, 0.118)], fin, center=(0, bore_y), segs=8, closed=True)
    crown = lathe("Crown", [(0.0045, 0.159), (0.0078, 0.159), (0.0078, 0.163), (0.0045, 0.163)], m["blued"], center=(0, bore_y), segs=28, closed=True)
    fs = prism("Front sight", [(0.084, 0.046), (0.1, 0.046), (0.098, 0.058), (0.09, 0.058)], -0.004, 0.004, fin, bevel=0.0005)
    fs = cut(fs, box("fs slot", (0, 0.056, 0.094), (0.0022, 0.006, 0.02), fin, bevel=0))
    fpost = box("Front sight post", (0, 0.054, 0.094), (0.0016, 0.008, 0.002), m["black"], bevel=0)
    rs = prism("Rear sight", [(-0.098, 0.046), (-0.08, 0.046), (-0.082, 0.058), (-0.096, 0.058)], -0.0065, 0.0065, fin, bevel=0.0005)
    rs = cut(rs, cyl("aperture", (0, 0.054, -0.089), 0.0018, 0.03, fin))
    # ribbed Bakelite grip on the pistol envelope, magazine through it
    grip = grip_loft("Grip ribs", "pistol", "Grip frame", 0.0205, m["bakelite"], y0=-0.14, y1=-0.022, shrink_front=0.002, shrink_back=0.002)
    grooves = []
    for i in range(10):
        y = -0.032 - i * 0.0105
        zb, zf = back(y), front(y)
        grooves.append(box(f"grip groove {i}", (0, y, (zb + zf) / 2), (0.06, 0.0022, (zf - zb) * 0.62), m["bakelite"], bevel=0))
    grip = cut(grip, grooves)
    ribs = []
    g_out = rounded_polygon([(-0.013, -0.018), (-0.012, -0.048), (0.004, -0.062), (0.044, -0.064), (0.064, -0.05), (0.066, -0.02)], 0.012)
    g_in = rounded_polygon([(-0.007, -0.018), (-0.006, -0.044), (0.006, -0.056), (0.04, -0.058), (0.058, -0.047), (0.06, -0.018)], 0.01)
    guard = band("Trigger guard", g_out, g_in, -0.0055, 0.0055, fin)
    sling = sweep("Sling loop", [(-0.0165, 0.0, -0.1), (-0.024, -0.002, -0.106), (-0.024, -0.014, -0.106), (-0.0165, -0.016, -0.1)], fin, radius=0.0016, segs=8)
    body = join("Receiver", [receiver, *seam, *rivets, lower, selector, *sel_marks, stamp, barrel, nut, crown, fs, fpost, rs, guard, sling])
    grip_all = join("Grip", [grip, *ribs])
    # folding wire stock, folded forward along the right side of the receiver
    wire = [(0.024, 0.036, -0.098), (0.026, 0.036, 0.06), (0.026, 0.004, 0.064), (0.024, 0.004, -0.098)]
    stock = sweep("Wire stock loop", wire, fin, radius=0.0024, segs=10, closed=True, smooth_path=0)
    hinge = cyl("Stock hinge", (0.022, 0.02, -0.1), 0.004, 0.036, fin, axis="y", segs=16)
    pad = box("Stock pad", (0.026, 0.02, 0.066), (0.006, 0.036, 0.008), m["black"], bevel=0.0015)
    stock_all = join("Stock", [stock, hinge, pad], pivot=(0.022, 0.02, -0.1))
    # bolt with charging knob on top, trigger, magazine
    bolt = box("Bolt body", (0, 0.03, -0.01), (0.022, 0.024, 0.09), m["blued"], bevel=0.0012)
    knob = lathe("Charging knob", [(0, 0.0475), (0.0055, 0.0475), (0.0062, 0.052), (0.0058, 0.058), (0, 0.0595)], m["black"], center=(0, -0.052), axis="y", segs=16)
    knob_ribs = [box(f"knob rib {i}", (0, 0.053, -0.052), (0.0132, 0.0012, 0.0012), m["black"], bevel=0) for i in range(1)]
    bolt_all = join("Bolt", [bolt, knob, *knob_ribs], pivot=(0, 0.03, -0.01))
    trig = prism("Trigger blade", rounded_polygon([(0.016, -0.018), (0.024, -0.018), (0.026, -0.032), (0.021, -0.046), (0.015, -0.049),
                                                   (0.017, -0.036), (0.017, -0.026)], 0.0018), -0.004, 0.004, m["blued"], bevel=0.0007)
    trigger = join("Trigger", [trig], pivot=(0, -0.016, 0.02))
    mag_top = -0.02
    mag_b = -0.235
    mprof = rounded_polygon([(back(-0.03) + 0.018, mag_top), (front(-0.03) - 0.012, mag_top), (front(-0.03) - 0.012 - 0.024, mag_b),
                             (back(-0.03) + 0.018 - 0.028, mag_b)], 0.003)
    mag = prism("Magazine body", mprof, -0.0085, 0.0085, m["park"], bevel=0.001)
    mag_ribs = [box(f"mag rib {i}", (0.0086 * s, -0.17 - i * 0.012, back(-0.03) - 0.002 - i * 0.002 + 0.03), (0.0012, 0.004, 0.022), m["park"], bevel=0) for i in range(3) for s in (1, -1)]
    floor = prism("Magazine floor plate", rounded_polygon([(back(-0.03) - 0.012, mag_b + 0.002), (front(-0.03) - 0.034, mag_b + 0.002),
                                                            (front(-0.03) - 0.034, mag_b - 0.006), (back(-0.03) - 0.012, mag_b - 0.006)], 0.002),
                  -0.0105, 0.0105, m["black"], bevel=0.0008)
    magazine = join("Magazine", [mag, *mag_ribs, floor], pivot=(0, mag_top, -0.05))
    return {"muzzle": (0, bore_y, 0.164), "hands": "pistol", "class": "machine pistol",
            "animated": ["Bolt", "Trigger", "Magazine", "Stock"]}


# ============================================================================= long-gun shared pieces
def stock(name, material, z_front=-0.106, z_back=-0.35, wrist=(0.044, 0.072, -0.029), comb_y=0.006, heel_y=-0.002,
          toe_y=-0.13, butt_w=0.05, pistol_grip=0.0, steps=16, straight=False):
    """Buttstock lofted from the receiver to the butt, matching the shotgun-hands wrist envelope at z -0.175..-0.108."""
    secs = []
    for i in range(steps + 1):
        u = i / steps
        z = z_front + (z_back - z_front) * u
        # top line: wrist top -> comb -> heel
        top = wrist[2] + wrist[1] / 2 + (comb_y - (wrist[2] + wrist[1] / 2)) * smoothstep(0.0, 0.35, u) + (heel_y - comb_y) * smoothstep(0.35, 1.0, u)
        # bottom line: wrist bottom stays, then drops to the toe after the grip
        wb = wrist[2] - wrist[1] / 2
        drop = smoothstep(0.18, 1.0, u)
        bottom = wb + (toe_y - wb) * drop
        if pistol_grip:
            bottom -= pistol_grip * math.exp(-((u - 0.2) / 0.1) ** 2)
        w = wrist[0] + (butt_w - wrist[0]) * smoothstep(0.15, 0.8, u)
        h = top - bottom
        secs.append((z, ellipse(w, h, 32, 0, (top + bottom) / 2, squash=1.45 if not straight else 1.3)))
    return loft(name, secs, material, bevel=0, sharp=70)


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def butt_pad(name, material, z, top, bottom, width, thick=0.012, lines=True):
    sec = lambda shrink: ellipse(width - shrink, top - bottom - shrink, 32, 0, (top + bottom) / 2, squash=1.45)
    pad = loft(name, [(z, sec(0)), (z - thick * 0.7, sec(0.001)), (z - thick, sec(0.006))], material, bevel=0, sharp=70)
    return pad


def fore_end(name, material, z0, z1, top, bottom, width, taper=0.9, steps=6, squash=1.5):
    secs = []
    for i in range(steps + 1):
        u = i / steps
        z = z0 + (z1 - z0) * u
        s = 1 - (1 - taper) * u
        # rounded nose/tail
        end = min(1.0, (u / 0.08) if u < 0.08 else ((1 - u) / 0.08 if u > 0.92 else 1.0))
        k = 0.82 + 0.18 * math.sqrt(max(0.0, end))
        secs.append((z, ellipse(width * s * k, (top - bottom) * k, 28, 0, (top + bottom) / 2 + (1 - k) * 0.004, squash=squash)))
    return loft(name, secs, material, bevel=0, sharp=70)


def trigger_blade(name, m, z, y_top, length=0.03, width=0.0045, pivot_up=0.002):
    prof = rounded_polygon([(z - 0.003, y_top), (z + 0.004, y_top), (z + 0.006, y_top - length * 0.5), (z + 0.002, y_top - length * 0.9),
                            (z - 0.004, y_top - length), (z - 0.002, y_top - length * 0.6), (z - 0.003, y_top - length * 0.3)], 0.0018)
    return join(name, [prism(name + " blade", prof, -width, width, m, bevel=0.0007)], pivot=(0, y_top + pivot_up, z))


def guard_band(name, m, z0, z1, y_top, y_bottom, width=0.005, thick=0.0045, r=0.012):
    outer = rounded_polygon([(z0, y_top), (z0 + 0.004, y_bottom + 0.012), (z0 + 0.02, y_bottom), (z1 - 0.018, y_bottom), (z1, y_bottom + 0.014), (z1 + 0.002, y_top)], r)
    inner = rounded_polygon([(z0 + thick, y_top + 0.002), (z0 + thick + 0.003, y_bottom + 0.012 + thick * 0.6), (z0 + 0.02, y_bottom + thick),
                             (z1 - 0.018, y_bottom + thick), (z1 - thick, y_bottom + 0.014), (z1 - thick + 0.002, y_top + 0.002)], r * 0.8)
    return band(name, outer, inner, -width, width, m)


def swivel(name, m, pos, r=0.006):
    x, y, z = pos
    ring = sweep(name, [(x, y - r * math.cos(a), z + r * math.sin(a)) for a in [i * TAU / 12 for i in range(12)]], m, radius=0.0012,
                 segs=8, closed=True, smooth_path=0)
    return ring


# ============================================================================= DOUBLE OR NOTHING
@weapon("doublebarrel")
def doublebarrel():
    m = M()
    steel, wood = m["blued"], m["walnut"]
    by, bx, br = 0.013, 0.0128, 0.0126      # barrel axis height, lateral offset, outer radius
    hinge = (0, -0.02, 0.028)
    # --- action body (case-coloured steel look via nickel + engraving)
    act = rounded_polygon([(-0.108, -0.024), (-0.108, 0.03), (-0.08, 0.034), (-0.02, 0.028), (0.03, 0.028), (0.032, -0.018),
                           (0.018, -0.032), (-0.06, -0.034)], 0.006)
    action = prism("Action body", act, -0.0255, 0.0255, m["nickel"], bevel=0.003, segments=3)
    fences = [lathe(f"Fence {s}", [(0, 0.024), (br + 0.002, 0.024), (br + 0.002, 0.03), (0, 0.032)], m["nickel"], center=(s * bx, by), segs=32)
              for s in (1, -1)]
    tang = prism("Top tang", rounded_polygon([(-0.108, 0.026), (-0.03, 0.03), (-0.03, 0.036), (-0.108, 0.032)], 0.003), -0.008, 0.008, m["nickel"], bevel=0.001)
    scroll = [text(f"Engraving {s}", "♥ ♠", (s * 0.026, -0.004, -0.04), 0.012, 0.0003, m["silver"], facing="+x" if s > 0 else "-x") for s in (1, -1)]
    scroll += [text(f"Engraving dice {s}", "⚃ ⚀", (s * 0.026, 0.014, -0.075), 0.009, 0.0003, m["silver"], facing="+x" if s > 0 else "-x") for s in (1, -1)]
    pins = [cyl(f"Pin {i}", (0.0258 * s, y, z), 0.0024, 0.0012, m["nickel"], axis="x", segs=14) for i, (y, z) in enumerate([(-0.02, 0.028), (-0.012, -0.05)]) for s in (1, -1)]
    guard = guard_band("Trigger guard", steel, -0.1, -0.02, -0.031, -0.074)
    body = join("Action", [action, *fences, tang, *scroll, *pins, guard])
    # --- hammers (pivots), triggers, top lever
    hammers = []
    for s, nm in ((1, "Right hammer"), (-1, "Left hammer")):
        hp = rounded_polygon([(-0.066, 0.02), (-0.052, 0.02), (-0.05, 0.034), (-0.058, 0.046), (-0.074, 0.052), (-0.082, 0.05), (-0.072, 0.042), (-0.066, 0.032)], 0.0025)
        h = prism(nm + " body", hp, s * 0.0195 - 0.0035, s * 0.0195 + 0.0035, steel, bevel=0.0008)
        chk = [box(f"{nm} check {i}", (s * 0.0195, 0.05 - i * 0.0012, -0.077 + i * 0.003), (0.0078, 0.0011, 0.0012), m["black"], bevel=0) for i in range(3)]
        hammers.append(join(nm, [h, *chk], pivot=(s * 0.0195, 0.022, -0.058)))
    triggers = [trigger_blade("Front trigger", steel, -0.052, -0.031, 0.03), trigger_blade("Rear trigger", steel, -0.075, -0.031, 0.028)]
    lever = join("Top lever", [prism("lever", rounded_polygon([(-0.06, 0.032), (-0.03, 0.032), (-0.03, 0.038), (-0.064, 0.04), (-0.086, 0.046), (-0.09, 0.042)], 0.003),
                                     0.0, 0.009, m["nickel"], bevel=0.0009),
                               cyl("lever spindle", (0, 0.036, -0.032), 0.006, 0.006, m["nickel"], axis="y", segs=20)], pivot=(0, 0.036, -0.032))
    # --- barrels (hinged) with ribs, bead, splinter fore-end and chambered shells
    L = 0.5
    tubes = []
    for s in (1, -1):
        tubes.append(lathe(f"Barrel {s}", [(0.0094, 0.03), (br, 0.03), (br, 0.08), (br * 0.86, L), (0.0094, L)], steel,
                           center=(s * bx, by), segs=36, closed=True, bevel=0.0004))
    top_rib = loft("Top rib", [(z, [(-0.006, by + br * 0.82), (0.006, by + br * 0.82), (0.0048, by + br * 1.02), (-0.0048, by + br * 1.02)]) for z in (0.03, L)], steel, sharp=20)
    low_rib = loft("Bottom rib", [(z, [(-0.006, by - br * 0.82), (-0.0048, by - br * 1.0), (0.0048, by - br * 1.0), (0.006, by - br * 0.82)]) for z in (0.12, L)], steel, sharp=20)
    bead = lathe("Brass bead", [(0, by + br + 0.0005), (0.0022, by + br + 0.0012), (0.0024, by + br + 0.0028), (0, by + br + 0.0046)], m["brass"],
                 center=(0, L - 0.008), axis="y", segs=16)
    lump = prism("Barrel lumps", rounded_polygon([(0.03, by - 0.004), (0.074, by - 0.004), (0.07, -0.024), (0.036, -0.03), (0.028, -0.024)], 0.004),
                 -0.012, 0.012, steel, bevel=0.001)
    fe = fore_end("Fore-end", wood, 0.07, 0.3, by - 0.004, -0.052, 0.05, taper=0.92)
    fe_tip = lathe("Fore-end tip", [(0, 0.3), (0.017, 0.3), (0.015, 0.306), (0, 0.307)], m["black"], center=(0, -0.026), segs=24)
    fe_iron = box("Fore-end iron", (0, -0.03, 0.09), (0.034, 0.016, 0.05), m["nickel"], bevel=0.002)
    band_mark = text("Barrel mark", "DOUBLE OR NOTHING · 12", (0.0, by + br * 1.02 + 0.0002, 0.2), 0.0045, 0.0002, m["silver"], facing="+y")
    barrels = join("Barrels", [*tubes, top_rib, low_rib, bead, lump, fe, fe_tip, fe_iron, band_mark], pivot=hinge)
    shells = join("Shells", [shotshell(f"Shell {s}", 0.026, 0.07, 0.0091, m, center=(s * bx, by)) for s in (1, -1)], pivot=(0, by, 0.026))
    parent(shells, barrels)
    # --- stock
    st = stock("Buttstock", wood, z_front=-0.104, z_back=-0.345, comb_y=0.012, heel_y=0.006, toe_y=-0.12, straight=True)
    chk = loft("Wrist checkering", [(z, ellipse(0.0452, 0.058, 32, 0, -0.028, squash=1.45)) for z in (-0.125, -0.165)], m["checker"], sharp=70)
    pad = butt_pad("Butt pad", m["rubber"], -0.345, 0.006, -0.12, 0.05)
    stock_all = join("Stock", [st, chk, pad])
    return {"muzzle": (0, by, L + 0.004), "muzzles": [(bx, by, L), (-bx, by, L)], "hands": "shotgun", "class": "side-by-side coach gun",
            "animated": ["Barrels", "Shells", "Right hammer", "Left hammer", "Front trigger", "Rear trigger", "Top lever"],
            "pivots": {"Barrels": hinge, "Top lever": (0, 0.036, -0.032)}}


# ============================================================================= LAST CALL
@weapon("autoshotgun")
def autoshotgun():
    m = M()
    steel, wood = m["blued"], m["walnut"]
    by = 0.033
    # --- receiver: rounded-top alloy receiver, ejection port right, loading port below
    rec = rounded_polygon([(-0.108, -0.03), (-0.108, 0.03), (-0.09, 0.044), (0.07, 0.046), (0.1, 0.044), (0.104, 0.02), (0.104, -0.03)], 0.006)
    receiver = prism("Receiver shell", rec, -0.0265, 0.0265, steel, bevel=0.0028, segments=3)
    port = box("port", (0.03, 0.02, 0.022), (0.02, 0.024, 0.06), steel, bevel=0)
    load = box("loading port", (0, -0.03, 0.03), (0.036, 0.02, 0.08), steel, bevel=0)
    receiver = cut(receiver, [port, load])
    scroll = text("Receiver scroll", "LAST CALL · 12 GA", (0.0266, -0.005, -0.03), 0.0062, 0.0002, m["brass"], facing="+x")
    tag = box("Inventory tag plate", (0.0268, 0.02, -0.075), (0.001, 0.012, 0.03), m["brass"], bevel=0.0006)
    tag_txt = text("Inventory tag", "HOUSE", (0.0275, 0.02, -0.075), 0.0056, 0.0002, m["black"], facing="+x")
    rivets = [cyl(f"Tag rivet {i}", (0.0276, 0.02, z), 0.0011, 0.0008, m["brass"], axis="x", segs=10) for i, z in enumerate((-0.088, -0.062))]
    pins = [cyl(f"Trigger pin {i}", (0.0266 * s, -0.018, z), 0.0024, 0.001, m["silver"], axis="x", segs=14) for i, z in enumerate((-0.06, 0.0)) for s in (1, -1)]
    safety = cyl("Crossbolt safety", (0, -0.024, -0.092), 0.0035, 0.058, m["black"], axis="x", segs=14)
    guard = guard_band("Trigger guard", m["black"], -0.098, -0.012, -0.03, -0.075)
    release = box("Carrier release", (-0.0268, -0.012, 0.012), (0.002, 0.008, 0.014), m["silver"], bevel=0.0006)
    body = join("Receiver", [receiver, scroll, tag, tag_txt, *rivets, *pins, safety, guard, release])
    # --- barrel with vent rib + beads, magazine tube, cap
    L = 0.7
    barrel = lathe("Barrel", [(0.0094, 0.095), (0.0128, 0.095), (0.0128, 0.14), (0.011, 0.2), (0.0104, L), (0.0094, L)], steel,
                   center=(0, by), segs=36, closed=True, bevel=0.0004)
    ring = lathe("Barrel ring", [(0.0104, 0.4), (0.0155, 0.4), (0.0155, 0.43), (0.0104, 0.43)], steel, center=(0, by - 0.004), segs=28, closed=True)
    rib = box("Vent rib", (0, by + 0.0165, 0.4), (0.0078, 0.0018, 0.6), steel, bevel=0.0005)
    posts = [box(f"Rib post {i}", (0, by + 0.013, 0.11 + i * 0.05), (0.004, 0.006, 0.006), steel, bevel=0.0004) for i in range(12)]
    beads = [lathe(f"Bead {i}", [(0, by + 0.017), (0.0018, by + 0.0175), (0.0019, by + 0.019), (0, by + 0.0205)], m["brass"] if i == 0 else m["sight_white"],
                   center=(0, z), axis="y", segs=12) for i, z in enumerate((0.692, 0.4))]
    tube_mag = cyl("Magazine tube", (0, -0.015, 0.27), 0.0115, 0.33, steel, segs=28)
    cap = lathe("Magazine cap", [(0, 0.43), (0.0125, 0.43), (0.0135, 0.436), (0.0135, 0.458), (0.011, 0.462), (0, 0.463)], m["black"], center=(0, -0.015), segs=24)
    knurl = [box(f"cap knurl {i}", (math.cos(i * TAU / 18) * 0.0136, -0.015 + math.sin(i * TAU / 18) * 0.0136, 0.447), (0.0014, 0.0014, 0.018), m["black"], bevel=0) for i in range(18)]
    swiv = swivel("Front swivel", steel, (0, -0.03, 0.452))
    muzzle_mark = text("Barrel mark", "HOUSE · FULL", (0.0106, by, 0.3), 0.0045, 0.0002, m["silver"], facing="+x")
    barrel_all = join("Barrel", [barrel, ring, rib, *posts, *beads, tube_mag, cap, *knurl, swiv, muzzle_mark])
    # --- walnut fore-end (left hand) with grooves
    fe = fore_end("Fore-end", wood, 0.105, 0.4, 0.019, -0.056, 0.058, taper=0.93)
    fe = cut(fe, [box(f"fore-end groove {i}", (0, -0.018 + s * 0.0, 0.2 + i * 0.03), (0.08, 0.003, 0.004), wood, bevel=0) for i in range(5) for s in (0,)])
    fe_all = join("Fore-end", [fe])
    # --- stock with semi-pistol grip, checkering, oxblood pad
    st = stock("Buttstock", wood, z_front=-0.106, z_back=-0.352, comb_y=0.01, heel_y=0.004, toe_y=-0.128, pistol_grip=0.012)
    chk = loft("Grip checkering", [(z, ellipse(0.0452, 0.056, 32, 0, -0.03, squash=1.45)) for z in (-0.122, -0.168)], m["checker"], sharp=70)
    cap_pg = lathe("Grip cap", [(0, -0.084), (0.012, -0.084), (0.012, -0.08), (0, -0.08)], m["black"], center=(0, -0.155), axis="y", segs=20)
    pad = butt_pad("Recoil pad", m["rubber"], -0.352, 0.004, -0.128, 0.05, thick=0.02)
    spacer = butt_pad("Pad spacer", m["sight_white"], -0.35, 0.0045, -0.1285, 0.0505, thick=0.002)
    stock_all = join("Stock", [st, chk, cap_pg, spacer, pad])
    # --- moving: bolt (right-side port) with handle, carrier, trigger
    bolt = box("Bolt face", (0.02, 0.02, 0.022), (0.012, 0.016, 0.05), m["silver"], bevel=0.0012)
    handle = lathe("Bolt handle", [(0, 0.0), (0.0035, 0.0), (0.004, 0.012), (0.0048, 0.018), (0.003, 0.022), (0, 0.0225)], m["silver"], center=(0.02, 0.046), axis="x", segs=14)
    move(handle, (0.012, 0, 0))
    bolt_all = join("Bolt", [bolt, handle], pivot=(0.02, 0.02, 0.03))
    carrier = join("Carrier", [box("Carrier plate", (0, -0.026, 0.03), (0.03, 0.004, 0.07), m["black"], bevel=0.001)], pivot=(0, -0.026, 0.0))
    trigger = trigger_blade("Trigger", m["black"], -0.055, -0.03, 0.032)
    loader = join("Loading shell", [shotshell("Loading shell", -0.02, 0.07, 0.0091, m, hull="paper_green", center=(0, -0.05))], pivot=(0, -0.05, 0.015))
    return {"muzzle": (0, by, L + 0.004), "hands": "shotgun", "class": "semi-automatic hunting shotgun",
            "animated": ["Bolt", "Carrier", "Trigger", "Loading shell"]}


# ============================================================================= SILVER DOLLAR
@weapon("lever")
def lever():
    m = M()
    steel, wood, brass = m["blued"], m["walnut"], m["brass"]
    by, my = 0.006, -0.0175   # barrel & magazine axis heights
    rec = rounded_polygon([(-0.112, -0.026), (-0.112, 0.024), (-0.096, 0.03), (0.05, 0.03), (0.062, 0.026), (0.062, -0.034), (0.03, -0.038),
                           (-0.09, -0.036)], 0.006)
    receiver = prism("Receiver shell", rec, -0.0185, 0.0185, brass, bevel=0.0026, segments=3)
    gate = box("gate cut", (0.019, -0.012, 0.03), (0.004, 0.016, 0.03), brass, bevel=0)
    receiver = cut(receiver, gate)
    gate_plate = prism("Loading gate", rounded_polygon([(0.016, -0.02), (0.046, -0.02), (0.046, -0.004), (0.016, -0.004)], 0.002), 0.0178, 0.0192, steel, bevel=0.0004)
    port = box("Ejection port", (0, 0.03, -0.01), (0.013, 0.004, 0.06), m["black"], bevel=0)
    screws = [screw(f"Receiver screw {i}", (0.0187 * s, y, z), 0.0022, steel) for i, (y, z) in enumerate([(-0.005, -0.03), (0.012, 0.0), (-0.024, 0.04)]) for s in (1, -1)]
    ring = sweep("Saddle ring", [(-0.022, -0.004 + 0.009 * math.sin(a), -0.07 + 0.009 * math.cos(a)) for a in [i * TAU / 16 for i in range(16)]], steel,
                 radius=0.0015, segs=8, closed=True, smooth_path=0)
    ring_stud = cyl("Saddle stud", (-0.0195, -0.004, -0.07), 0.003, 0.004, steel, axis="x", segs=12)
    engraving = text("Receiver engraving", "SILVER DOLLAR", (0.0187, 0.012, -0.06), 0.0058, 0.0003, m["silver"], facing="+x")
    body = join("Receiver", [receiver, gate_plate, port, *screws, ring, ring_stud, engraving])
    # --- octagonal barrel, magazine tube, bands, sights
    L = 0.58
    barrel = loft("Barrel", [(z, poly(8, r, 0, by, phase=math.pi / 8)) for z, r in ((0.06, 0.0112), (0.12, 0.0108), (L, 0.0096))], steel, sharp=30)
    barrel = cut(barrel, cyl("bore", (0, by, L), 0.0055, 0.1, steel, segs=20))
    tube_mag = cyl("Magazine tube", (0, my, 0.29), 0.0078, 0.46, steel, segs=24)
    bands = [lathe(f"Band {i}", [(0, z - 0.006), (0.0, z - 0.006)], steel) if False else
             loft(f"Band {i}", [(zz, rrect(0.024, 0.042, 0.008, 4, 0, (by + my) / 2)) for zz in (z - 0.006, z + 0.006)], steel, bevel=0.0008)
             for i, z in enumerate((0.3, 0.51))]
    fsight = prism("Front sight", [(0.55, by + 0.009), (0.57, by + 0.009), (0.568, by + 0.021), (0.562, by + 0.022)], -0.0014, 0.0014, m["silver"], bevel=0.0003)
    fbase = box("Front sight base", (0, by + 0.009, 0.56), (0.008, 0.004, 0.03), steel, bevel=0.0008)
    rsight = prism("Rear sight", [(0.14, by + 0.009), (0.17, by + 0.009), (0.168, by + 0.02), (0.142, by + 0.02)], -0.009, 0.009, steel, bevel=0.0005)
    rsight = cut(rsight, box("notch", (0, by + 0.02, 0.155), (0.003, 0.008, 0.05), steel, bevel=0))
    rollmark = text("Barrel rollmark", "SILVER DOLLAR · .44-40 · MODEL OF 1973", (0.0098, by, 0.35), 0.0042, 0.0002, m["silver"], facing="+x")
    barrel_all = join("Barrel", [barrel, tube_mag, *bands, fsight, fbase, rsight, rollmark])
    # --- forearm (left hand) and straight-grip stock with silver dollar inlay
    fe = fore_end("Forearm", wood, 0.064, 0.3, by + 0.013, my - 0.018, 0.034, taper=0.95, squash=1.35)
    fe_cap = loft("Forearm cap", [(z, rrect(0.034, by + 0.013 - (my - 0.018), 0.01, 4, 0, (by + 0.013 + my - 0.018) / 2)) for z in (0.3, 0.306)], steel, bevel=0.001)
    fe_all = join("Forearm", [fe, fe_cap])
    st = stock("Buttstock", wood, z_front=-0.11, z_back=-0.355, wrist=(0.04, 0.062, -0.026), comb_y=0.004, heel_y=0.004, toe_y=-0.118, butt_w=0.042, straight=True)
    plate = butt_pad("Butt plate", brass, -0.355, 0.004, -0.118, 0.042, thick=0.004)
    coin = lathe("Silver dollar", [(0, 0.0), (0.0145, 0.0), (0.0145, 0.0018), (0.0125, 0.0022), (0, 0.0026)], m["silver"], center=(-0.058, -0.25), axis="x", segs=40)
    move(coin, (0.0205, 0, 0))
    coin_mark = text("Coin relief", "★", (0.0234, -0.058, -0.25), 0.014, 0.0004, m["silver"], facing="+x")
    stock_all = join("Stock", [st, plate, coin, coin_mark])
    # --- hammer, lever loop (pivot at the front of the receiver), trigger, loading cartridge
    hpiv = (0, 0.004, -0.07)
    hammer = join("Hammer", [prism("Hammer body", rounded_polygon([(-0.078, 0.0), (-0.062, 0.0), (-0.06, 0.02), (-0.07, 0.034), (-0.09, 0.042), (-0.098, 0.04),
                                                                    (-0.086, 0.032), (-0.078, 0.02)], 0.0025), -0.0045, 0.0045, steel, bevel=0.0008)], pivot=hpiv)
    lpiv = (0, -0.032, 0.036)
    loop_pts = [(0, -0.036, 0.04), (0, -0.042, 0.0), (0, -0.044, -0.04), (0, -0.05, -0.08), (0, -0.07, -0.108), (0, -0.1, -0.12),
                (0, -0.118, -0.1), (0, -0.112, -0.07), (0, -0.09, -0.06), (0, -0.064, -0.05), (0, -0.05, -0.03), (0, -0.046, 0.0), (0, -0.038, 0.036)]
    loop = sweep("Lever loop", loop_pts, steel, radius=0.0052, height=0.0035, segs=12, closed=True)
    lever = join("Lever", [loop, cyl("Lever pivot", (0, -0.032, 0.036), 0.004, 0.04, steel, axis="x", segs=14)], pivot=lpiv)
    trigger = trigger_blade("Trigger", steel, -0.052, -0.034, 0.024)
    case, bullet = cartridge("Loading round", -0.03, 0.04, 0.0058, 0.0054, m, rim=0.0008, bullet_len=0.013, center=(0.03, -0.012), nose="flat")
    loading = join("Loading round", [case, bullet], pivot=(0.03, -0.012, -0.01))
    return {"muzzle": (0, by, L + 0.003), "hands": "shotgun", "class": "lever-action rifle",
            "animated": ["Lever", "Hammer", "Trigger", "Loading round"], "pivots": {"Lever": lpiv, "Hammer": hpiv}}


# ============================================================================= EYE IN THE SKY
@weapon("sniper")
def sniper():
    m = M()
    steel, wood = m["blued"], m["walnut_dark"]
    by = 0.016
    # --- round receiver with bolt raceway + internal magazine floorplate
    receiver = tube("Receiver ring", (0, by), 0.0165, 0.0095, -0.11, 0.075, steel, segs=36)
    receiver = cut(receiver, box("ejection port", (0.013, by + 0.004, -0.02), (0.02, 0.022, 0.07), steel, bevel=0))
    recoil_lug = lathe("Front ring", [(0.0095, 0.05), (0.018, 0.05), (0.018, 0.075), (0.0095, 0.075)], steel, center=(0, by), segs=36, closed=True)
    tang = prism("Rear tang", rounded_polygon([(-0.16, 0.0), (-0.11, 0.004), (-0.11, 0.012), (-0.16, 0.008)], 0.002), -0.006, 0.006, steel, bevel=0.0008)
    floor = prism("Floorplate", rounded_polygon([(-0.03, -0.034), (0.05, -0.034), (0.05, -0.04), (-0.03, -0.04)], 0.002), -0.014, 0.014, steel, bevel=0.0008)
    guard = guard_band("Trigger guard", steel, -0.1, -0.03, -0.034, -0.078)
    body = join("Receiver", [receiver, recoil_lug, tang, floor, guard])
    # --- barrel, bands, muzzle
    L = 0.76
    barrel = lathe("Barrel", [(0.0036, 0.075), (0.0118, 0.075), (0.0118, 0.12), (0.0098, 0.3), (0.0086, L), (0.0036, L)], steel, center=(0, by), segs=32, closed=True)
    crown = lathe("Crown", [(0.0036, L - 0.0005), (0.0086, L - 0.0005), (0.0078, L + 0.002), (0.0042, L + 0.002)], steel, center=(0, by), segs=32, closed=True)
    bands = [loft(f"Barrel band {i}", [(zz, rrect(w, h, 0.012, 5, 0, cy)) for zz in (z - 0.008, z + 0.008)], steel, bevel=0.001)
             for i, (z, w, h, cy) in enumerate(((0.3, 0.038, 0.05, -0.002), (0.53, 0.032, 0.042, 0.002)))]
    swivels = [swivel("Front swivel", steel, (0, -0.026, 0.53)), swivel("Rear swivel", steel, (0, -0.126, -0.28))]
    barrel_all = join("Barrel", [barrel, crown, *bands, *swivels])
    # --- military stock: full fore-end with top handguard, straight wrist, steel butt plate
    fe = fore_end("Fore-end", wood, 0.07, 0.54, by + 0.008, -0.036, 0.036, taper=0.8, steps=10, squash=1.4)
    hg = fore_end("Handguard", wood, 0.09, 0.29, by + 0.016, by - 0.002, 0.03, taper=0.95, squash=1.2)
    mid = loft("Stock mid", [(z, ellipse(0.036, 0.06, 32, 0, -0.012, squash=1.4)) for z in (-0.11, 0.075)], wood, sharp=70)
    st = stock("Buttstock", wood, z_front=-0.104, z_back=-0.358, comb_y=0.014, heel_y=0.004, toe_y=-0.13, straight=True)
    plate = butt_pad("Butt plate", steel, -0.358, 0.004, -0.13, 0.05, thick=0.004)
    inv = text("Inventory number", "No 1106", (0.024, -0.05, -0.27), 0.0085, 0.0003, m["walnut"], facing="+x")
    stock_all = join("Stock", [fe, hg, mid, st, plate, inv])
    # --- period fixed 4x scope with rings, turrets and glass
    sy = 0.064
    scope = lathe("Scope tube", [(0, -0.15), (0.0175, -0.15), (0.0175, -0.1), (0.0125, -0.075), (0.0125, 0.1), (0.0205, 0.14), (0.0205, 0.2), (0, 0.2)],
                  m["black"], center=(0, sy), segs=40, bevel=0.0008)
    lens_f = cyl("Objective glass", (0, sy, 0.2005), 0.018, 0.001, m["glass"], segs=32)
    lens_r = cyl("Ocular glass", (0, sy, -0.1505), 0.015, 0.001, m["glass"], segs=32)
    turret_t = cyl("Elevation cap", (0, sy + 0.016, 0.02), 0.009, 0.014, m["black"], axis="y", segs=24)
    turret_r = cyl("Windage cap", (0.016, sy, 0.02), 0.009, 0.014, m["black"], axis="x", segs=24)
    rings = []
    for z in (-0.045, 0.055):
        rings.append(lathe(f"Scope ring {z}", [(0.0125, z - 0.006), (0.0155, z - 0.006), (0.0155, z + 0.006), (0.0125, z + 0.006)], steel, center=(0, sy), segs=32, closed=True))
        rings.append(box(f"Ring base {z}", (0, (sy + by) / 2 + 0.004, z), (0.012, sy - by - 0.02, 0.012), steel, bevel=0.001))
    scope_mark = text("Scope mark", "4× · HOUSE OPTICS", (0.0126, sy, 0.0), 0.0042, 0.0002, m["silver"], facing="+x")
    scope_all = join("Scope", [scope, lens_f, lens_r, turret_t, turret_r, *rings, scope_mark])
    # --- leather sling hanging on the left
    sl = [(-0.012, -0.03, 0.53), (-0.016, -0.08, 0.35), (-0.02, -0.11, 0.12), (-0.02, -0.14, -0.08), (-0.016, -0.14, -0.2), (-0.012, -0.13, -0.28)]
    sling = join("Sling", [sweep("Sling strap", sl, m["leather"], radius=0.0028, height=0.0105, segs=10)])
    # --- bolt (moving): body inside the receiver, handle turned down on the right, cocking piece
    bolt = cyl("Bolt body", (0, by, -0.035), 0.0092, 0.15, m["silver"], segs=24)
    shroud = lathe("Bolt shroud", [(0, -0.13), (0.011, -0.13), (0.012, -0.115), (0.0095, -0.11), (0, -0.11)], steel, center=(0, by), segs=24)
    stem = sweep("Bolt handle stem", [(0.008, by, -0.074), (0.026, by - 0.006, -0.078), (0.04, by - 0.018, -0.084)], m["silver"], radius=0.0034, segs=10)
    knob = lathe("Bolt knob", [(0, -0.009), (0.0075, -0.007), (0.0082, 0.0), (0.0075, 0.007), (0, 0.009)], m["silver"], center=(by - 0.022, -0.086), axis="x", segs=16)
    move(knob, (0.044, 0, 0))
    bolt_all = join("Bolt", [bolt, shroud, stem, knob], pivot=(0, by, -0.035))
    trigger = trigger_blade("Trigger", steel, -0.062, -0.034, 0.03)
    rounds = []
    for i in range(3):
        c, b = cartridge(f"Clip round {i}", -0.04, 0.078, 0.006, 0.0038, m, bullet_len=0.028, neck=0.0042, center=(0.006 * (i - 1), by + 0.035 + i * 0.002), nose="spitzer")
        rounds += [c, b]
    clip = box("Stripper clip", (0, by + 0.04, -0.038), (0.024, 0.006, 0.004), m["park"], bevel=0.0005)
    loader = join("Stripper clip", [*rounds, clip], pivot=(0, by + 0.035, -0.02))
    return {"muzzle": (0, by, L + 0.002), "hands": "shotgun", "class": "military-surplus bolt-action rifle with 4x scope",
            "animated": ["Bolt", "Trigger", "Stripper clip"]}


# ============================================================================= THE DEBT COLLECTOR
@weapon("launcher")
def launcher():
    m = M()
    steel, wood = m["black"], m["walnut"]
    by, R, r = 0.028, 0.026, 0.0205
    hinge = (0, -0.018, 0.035)
    rec = rounded_polygon([(-0.12, -0.03), (-0.12, 0.04), (-0.1, 0.054), (0.036, 0.054), (0.04, 0.0), (0.03, -0.026), (-0.04, -0.034)], 0.006)
    receiver = prism("Receiver body", rec, -0.028, 0.028, m["olive"], bevel=0.003, segments=3)
    breech = cut(lathe("Breech face", [(0, 0.034), (R + 0.001, 0.034), (R + 0.001, 0.04), (0, 0.04)], steel, center=(0, by), segs=40),
                 cyl("firing pin hole", (0, by, 0.04), 0.002, 0.02, steel))
    latch = join("Latch", [prism("Latch lever", rounded_polygon([(-0.05, 0.05), (-0.01, 0.05), (0.0, 0.058), (-0.012, 0.064), (-0.052, 0.06)], 0.003),
                                     -0.008, 0.008, steel, bevel=0.001)], pivot=(0, 0.056, -0.03))
    guard = guard_band("Trigger guard", steel, -0.1, -0.03, -0.03, -0.076)
    sten = text("Stencil", "DEBT COLLECTOR  40MM  INV 74-0318", (0.0284, 0.012, -0.045), 0.0055, 0.0002, m["stencil"], facing="+x")
    sten2 = text("Stencil left", "HOUSE PROPERTY", (-0.0284, 0.012, -0.045), 0.0055, 0.0002, m["stencil"], facing="-x")
    body = join("Receiver", [receiver, breech, guard, sten, sten2])
    L = 0.33
    tubeo = lathe("Barrel tube", [(r, 0.036), (R, 0.036), (R, 0.06), (R - 0.0015, 0.07), (R - 0.0015, L - 0.012), (R, L - 0.006), (R, L), (r, L)], m["park"],
                  center=(0, by), segs=48, closed=True, bevel=0.0005)
    rifling = [box(f"Rifling {i}", (math.cos(i * TAU / 8) * (r - 0.0004), by + math.sin(i * TAU / 8) * (r - 0.0004), L - 0.04), (0.002, 0.002, 0.07), m["bore"], bevel=0) for i in range(8)]
    lug = prism("Hinge lug", rounded_polygon([(0.03, by - R + 0.004), (0.08, by - R + 0.004), (0.074, -0.026), (0.036, -0.03)], 0.004), -0.014, 0.014, m["park"], bevel=0.001)
    hg = fore_end("Handguard", wood, 0.09, 0.29, by - R + 0.004, -0.052, 0.05, taper=0.95, squash=1.4)
    ladder = [box("Ladder frame L", (-0.009, by + R + 0.012, 0.12), (0.002, 0.024, 0.004), steel, bevel=0),
              box("Ladder frame R", (0.009, by + R + 0.012, 0.12), (0.002, 0.024, 0.004), steel, bevel=0)]
    ladder += [box(f"Ladder rung {i}", (0, by + R + 0.004 + i * 0.006, 0.12), (0.018, 0.0014, 0.003), steel, bevel=0) for i in range(4)]
    ladder.append(box("Ladder base", (0, by + R + 0.001, 0.12), (0.024, 0.004, 0.02), steel, bevel=0.0008))
    bead = box("Front blade", (0, by + R + 0.006, L - 0.01), (0.003, 0.012, 0.006), steel, bevel=0.0005)
    barrel = join("Barrel", [tubeo, *rifling, lug, hg, *ladder, bead], pivot=hinge)
    shell = []
    case = lathe("Shell case", [(0, 0.037), (0.0214, 0.037), (0.0214, 0.041), (0.0198, 0.0415), (0.0198, 0.08), (0, 0.08)], m["brass"], center=(0, by), segs=36)
    nose = lathe("Shell projectile", [(0, 0.078), (0.0198, 0.078), (0.0198, 0.092), (0.017, 0.108), (0.011, 0.118), (0, 0.121)], m["olive"], center=(0, by), segs=36)
    band_ = lathe("Shell band", [(0.0199, 0.083), (0.0203, 0.083), (0.0203, 0.087), (0.0199, 0.087)], m["brass"], center=(0, by), segs=36, closed=True)
    primer = cyl("Shell primer", (0, by, 0.0365), 0.0045, 0.001, m["silver"], segs=16)
    shell = join("Shell", [case, nose, band_, primer], pivot=(0, by, 0.037))
    parent(shell, barrel)
    st = stock("Buttstock", wood, z_front=-0.118, z_back=-0.36, comb_y=0.022, heel_y=0.016, toe_y=-0.12, butt_w=0.052, pistol_grip=0.016)
    pad = butt_pad("Recoil pad", m["rubber"], -0.36, 0.016, -0.12, 0.052, thick=0.022)
    stock_all = join("Stock", [st, pad])
    trigger = trigger_blade("Trigger", steel, -0.06, -0.03, 0.03)
    return {"muzzle": (0, by, L + 0.002), "hands": "shotgun", "class": "single-shot break-open 40 mm launcher",
            "animated": ["Barrel", "Shell", "Latch", "Trigger"], "pivots": {"Barrel": hinge}}


# ============================================================================= CHICAGO TYPEWRITER
@weapon("tommy")
def tommy():
    m = M()
    steel, wood = m["blued"], m["walnut"]
    by = 0.02
    # --- receiver and lower frame
    rec = rounded_polygon([(-0.13, -0.026), (-0.13, 0.034), (-0.11, 0.046), (0.1, 0.046), (0.125, 0.036), (0.125, -0.026)], 0.007)
    receiver = prism("Receiver shell", rec, -0.0215, 0.0215, steel, bevel=0.0026, segments=3)
    receiver = cut(receiver, [box("Ejection port", (0.02, 0.02, 0.02), (0.02, 0.02, 0.05), steel, bevel=0),
                              box("Actuator slot", (0, 0.047, 0.0), (0.006, 0.01, 0.13), steel, bevel=0)])
    frame = prism("Lower frame", rounded_polygon([(-0.13, -0.026), (0.045, -0.026), (0.04, -0.038), (-0.12, -0.04)], 0.004), -0.0185, 0.0185, steel, bevel=0.0015)
    guard = guard_band("Trigger guard", steel, -0.045, 0.035, -0.038, -0.078)
    rsight = prism("Rear sight", rounded_polygon([(-0.12, 0.046), (-0.085, 0.046), (-0.09, 0.066), (-0.114, 0.066)], 0.002), -0.009, 0.009, steel, bevel=0.0006)
    rsight = cut(rsight, cyl("Peep", (0, 0.06, -0.1), 0.0022, 0.05, steel))
    selector = [prism(f"Lever {i}", rounded_polygon([(z, -0.012), (z + 0.02, -0.008), (z + 0.02, -0.002), (z, -0.004)], 0.002), -0.0245, -0.0215, steel, bevel=0.0005)
                for i, z in enumerate((-0.07, -0.04))]
    mark = text("Receiver mark", "CHICAGO TYPEWRITER · .45", (0.0217, 0.022, -0.06), 0.0056, 0.0002, m["silver"], facing="+x")
    mark2 = text("Model mark", "MODEL OF 1928 · HOUSE", (0.0217, 0.006, -0.06), 0.0042, 0.0002, m["silver"], facing="+x")
    swiv = swivel("Rear swivel", steel, (0, -0.12, -0.3))
    body = join("Receiver", [receiver, frame, guard, rsight, *selector, mark, mark2, swiv])
    # --- ribbed cooling barrel + compensator
    L = 0.47
    barrel = lathe("Barrel", [(0.0058, 0.125), (0.0098, 0.125), (0.0098, L - 0.05), (0.0058, L - 0.05)], steel, center=(0, by), segs=28, closed=True)
    fins = [lathe(f"Fin {i}", [(0.0098, z - 0.0022), (0.0165, z - 0.0018), (0.0165, z + 0.0018), (0.0098, z + 0.0022)], steel, center=(0, by), segs=28, closed=True)
            for i, z in enumerate([0.14 + k * 0.0105 for k in range(17)])]
    comp = lathe("Compensator", [(0.0058, L - 0.052), (0.0125, L - 0.052), (0.0125, L), (0.0058, L)], steel, center=(0, by), segs=32, closed=True)
    comp = cut(comp, [box(f"Comp slot {i}", (0, by + 0.012, L - 0.042 + i * 0.0085), (0.018, 0.012, 0.004), steel, bevel=0) for i in range(4)])
    fsight = box("Front sight", (0, by + 0.017, L - 0.02), (0.002, 0.01, 0.006), steel, bevel=0.0004)
    barrel_all = join("Barrel", [barrel, *fins, comp, fsight])
    # --- walnut: pistol grip (rifle hand envelope), horizontal forearm, compact stock
    grip = grip_loft("Pistol grip", "rifle", "Walnut pistol grip", 0.02, wood, y1=-0.036, extend_top=0.01)
    fe = fore_end("Forearm", wood, 0.2, 0.4, by - 0.012, -0.05, 0.05, taper=0.95, squash=1.35)
    fe = cut(fe, [box(f"Forearm groove {i}", (0, -0.03, 0.24 + i * 0.03), (0.08, 0.004, 0.005), wood, bevel=0) for i in range(5)])
    fe_mount = box("Forearm mount", (0, by - 0.008, 0.2), (0.012, 0.01, 0.03), steel, bevel=0.001)
    st = stock("Buttstock", wood, z_front=-0.13, z_back=-0.33, wrist=(0.04, 0.05, -0.006), comb_y=0.012, heel_y=0.01, toe_y=-0.105, butt_w=0.046)
    st_plate = butt_pad("Butt plate", steel, -0.33, 0.01, -0.105, 0.046, thick=0.004)
    stock_all = join("Stock", [grip, fe, fe_mount, st, st_plate])
    # --- drum magazine (jostles while firing, slides out sideways for the reload)
    dc = (0, -0.098, 0.1)
    dr = 0.078
    drum = lathe("Drum shell", [(0, -0.021), (dr - 0.004, -0.021), (dr, -0.018), (dr, 0.018), (dr - 0.004, 0.021), (0, 0.021)], m["black"],
                 center=(dc[1], dc[2]), axis="x", segs=64, bevel=0.0006)
    rings = [lathe(f"Drum ring {i}", [(r0, 0.021), (r0 + 0.004, 0.021), (r0 + 0.004, 0.0235), (r0, 0.0235)], m["black"], center=(dc[1], dc[2]), axis="x", segs=48, closed=True)
             for i, r0 in enumerate((0.03, 0.058))]
    hub = lathe("Drum hub", [(0, 0.021), (0.018, 0.021), (0.016, 0.026), (0, 0.027)], steel, center=(dc[1], dc[2]), axis="x", segs=32)
    rivets = [cyl(f"Drum rivet {i}", (0.023, dc[1] + math.cos(i * TAU / 10) * 0.07, dc[2] + math.sin(i * TAU / 10) * 0.07), 0.0022, 0.002, steel, axis="x", segs=10) for i in range(10)]
    rings_l = [mirror_x(r, f"Drum ring back {i}") for i, r in enumerate(rings)]
    witness = box("Brass witness mark", (0.0238, dc[1] + 0.045, dc[2] + 0.02), (0.0008, 0.018, 0.005), m["brass"], bevel=0)
    feed = box("Drum feed lip", (0, -0.03, dc[2]), (0.02, 0.02, 0.03), m["black"], bevel=0.001)
    drum_all = join("Drum", [drum, *rings, *rings_l, hub, *rivets, witness, feed], pivot=dc)
    key = join("Drum key", [prism("Winding key", rounded_polygon([(-0.012, -0.004), (0.012, -0.004), (0.014, 0.004), (-0.014, 0.004)], 0.003), 0.0265, 0.031, steel, bevel=0.0008)],
               pivot=(0.028, dc[1], dc[2]))
    move(key, (0, dc[1], dc[2]))
    set_pivot(key, (0.028, dc[1], dc[2]))
    parent(key, drum_all)
    # --- actuator (bolt knob on top) and trigger
    act = lathe("Actuator knob", [(0, 0.044), (0.0055, 0.044), (0.0066, 0.05), (0.0062, 0.058), (0, 0.0595)], steel, center=(0, 0.02), axis="y", segs=16)
    act_stem = box("Actuator stem", (0, 0.042, 0.02), (0.005, 0.01, 0.01), steel, bevel=0.0006)
    bolt = join("Bolt", [act, act_stem], pivot=(0, 0.046, 0.02))
    trigger = trigger_blade("Trigger", steel, -0.012, -0.038, 0.03)
    return {"muzzle": (0, by, L + 0.003), "hands": "rifle", "class": "drum-fed submachine gun",
            "animated": ["Drum", "Drum key", "Bolt", "Trigger"], "pivots": {"Drum": dc}}


# ============================================================================= HOUSE EDGE
@weapon("lmg")
def lmg():
    m = M()
    steel, wood = m["park"], m["walnut_dark"]
    by = 0.022
    rec = rounded_polygon([(-0.15, -0.034), (-0.15, 0.05), (0.18, 0.05), (0.19, 0.04), (0.19, -0.02), (0.16, -0.034)], 0.006)
    receiver = prism("Receiver shell", rec, -0.028, 0.028, steel, bevel=0.0024, segments=2)
    receiver = cut(receiver, [box("Handle slot", (0.028, 0.012, 0.06), (0.006, 0.008, 0.2), steel, bevel=0),
                              box("Feed window", (-0.028, 0.03, 0.02), (0.01, 0.018, 0.05), steel, bevel=0)])
    ribs = [box(f"Stamp rib {i}", (0.0285 * s, -0.012, -0.12 + i * 0.05), (0.0012, 0.03, 0.008), steel, bevel=0.0004) for i in range(6) for s in (1, -1)]
    tray = box("Feed tray", (0, 0.05, 0.02), (0.06, 0.004, 0.06), steel, bevel=0.0008)
    plaque = box("Serial plaque", (0.0292, 0.024, -0.08), (0.001, 0.016, 0.05), m["brass"], bevel=0.0005)
    plaque_t = text("Serial number", "No 0707", (0.03, 0.024, -0.08), 0.0068, 0.0002, m["black"], facing="+x")
    sten = text("Stencil", "HOUSE EDGE  SECURITY INV 07", (0.0288, -0.012, 0.06), 0.006, 0.0002, m["stencil"], facing="+x")
    guard = guard_band("Trigger guard", steel, -0.045, 0.035, -0.034, -0.078)
    rsight = prism("Rear sight", rounded_polygon([(-0.13, 0.05), (-0.1, 0.05), (-0.104, 0.07), (-0.126, 0.07)], 0.002), -0.01, 0.01, steel, bevel=0.0006)
    rsight = cut(rsight, cyl("Peep", (0, 0.064, -0.115), 0.0022, 0.05, steel))
    body = join("Receiver", [receiver, *ribs, tray, plaque, plaque_t, sten, guard, rsight])
    # --- barrel, perforated shroud, flash hider, bipod (folded)
    L = 0.64
    barrel = lathe("Barrel", [(0.005, 0.18), (0.0115, 0.18), (0.0115, L - 0.06), (0.005, L - 0.06)], m["black"], center=(0, by), segs=28, closed=True)
    shroud = tube("Shroud", (0, by), 0.024, 0.021, 0.18, 0.52, steel, segs=36)
    holes = []
    for i in range(9):
        for k in range(6):
            a = k * TAU / 6 + (i % 2) * TAU / 12
            holes.append(cyl(f"Shroud hole {i}-{k}", (math.cos(a) * 0.0225, by + math.sin(a) * 0.0225, 0.21 + i * 0.034), 0.0052, 0.012, steel,
                             axis="x" if abs(math.cos(a)) > 0.7 else "y", segs=12))
    shroud = cut(shroud, holes)
    cap = lathe("Shroud cap", [(0.0115, 0.515), (0.0245, 0.515), (0.022, 0.53), (0.0115, 0.532)], steel, center=(0, by), segs=36, closed=True)
    hider = lathe("Flash hider", [(0.006, L - 0.07), (0.011, L - 0.07), (0.014, L), (0.011, L), (0.006, L - 0.06)], m["black"], center=(0, by), segs=28, closed=True)
    hider = cut(hider, [box(f"Hider slot {k}", (math.cos(k * TAU / 5) * 0.013, by + math.sin(k * TAU / 5) * 0.013, L - 0.02), (0.006, 0.006, 0.04), steel, bevel=0) for k in range(5)])
    fsight = box("Front sight", (0, by + 0.03, 0.5), (0.003, 0.018, 0.006), steel, bevel=0.0005)
    bip_hinge = cyl("Bipod hinge", (0, by - 0.026, 0.48), 0.006, 0.05, steel, axis="x", segs=16)
    legs = [cyl(f"Bipod leg {s}", (s * 0.012, by - 0.03, 0.34), 0.0045, 0.28, steel, segs=12) for s in (1, -1)]
    feet = [box(f"Bipod foot {s}", (s * 0.012, by - 0.03, 0.2), (0.012, 0.006, 0.012), steel, bevel=0.001) for s in (1, -1)]
    barrel_all = join("Barrel", [barrel, shroud, cap, hider, fsight, bip_hinge, *legs, *feet])
    # --- furniture: pistol grip, handguard under the shroud, stock with shoulder rest
    grip = grip_loft("Pistol grip", "rifle", "Walnut pistol grip", 0.021, wood, y1=-0.036, extend_top=0.004)
    hg = fore_end("Handguard", wood, 0.2, 0.42, by - 0.018, -0.052, 0.054, taper=0.97, squash=1.3)
    hg = cut(hg, [box(f"Handguard slot {i}", (0, -0.035, 0.24 + i * 0.035), (0.08, 0.006, 0.012), wood, bevel=0) for i in range(5)])
    st = stock("Buttstock", wood, z_front=-0.148, z_back=-0.4, wrist=(0.044, 0.07, 0.006), comb_y=0.03, heel_y=0.02, toe_y=-0.1, butt_w=0.05)
    plate = butt_pad("Butt plate", steel, -0.4, 0.02, -0.1, 0.05, thick=0.006)
    stock_all = join("Stock", [grip, hg, st, plate])
    # --- feed cover (hinged at the rear), belt box on the left, belt, charging handle
    cover = prism("Feed cover", rounded_polygon([(-0.07, 0.05), (0.13, 0.05), (0.13, 0.062), (0.1, 0.07), (-0.05, 0.07), (-0.07, 0.062)], 0.004), -0.03, 0.03, steel, bevel=0.0015)
    latch = box("Cover latch", (0.0, 0.071, 0.12), (0.02, 0.004, 0.012), m["black"], bevel=0.0008)
    cover_all = join("Feed cover", [cover, latch], pivot=(0, 0.06, -0.07))
    boxc = (-0.07, -0.07, 0.03)
    ammo_box = box("Box shell", boxc, (0.06, 0.12, 0.13), m["olive"], bevel=0.004)
    box_lid = box("Box lid", (boxc[0], boxc[1] + 0.061, boxc[2]), (0.064, 0.006, 0.134), m["olive"], bevel=0.002)
    box_mark = text("Box stencil", "7.62 · 100 · HOUSE", (boxc[0] - 0.0302, boxc[1], boxc[2]), 0.007, 0.0002, m["stencil"], facing="-x")
    box_mark2 = text("Box stencil right", "LINKED", (boxc[0] + 0.0302, boxc[1] - 0.02, boxc[2]), 0.008, 0.0002, m["stencil"], facing="+x")
    handle = sweep("Box handle", [(boxc[0], boxc[1] + 0.064, boxc[2] - 0.03), (boxc[0], boxc[1] + 0.075, boxc[2] - 0.02), (boxc[0], boxc[1] + 0.075, boxc[2] + 0.02),
                                  (boxc[0], boxc[1] + 0.064, boxc[2] + 0.03)], m["black"], radius=0.002, segs=8)
    box_mount = box("Box bracket", (-0.036, -0.02, 0.03), (0.018, 0.03, 0.05), steel, bevel=0.001)
    ammo = join("Ammo box", [ammo_box, box_lid, box_mark, box_mark2, handle, box_mount], pivot=(-0.04, -0.01, 0.03))
    belt = []
    for i in range(9):
        t = i / 8
        x = -0.075 + 0.07 * math.sin(t * math.pi / 2)
        y = boxc[1] + 0.06 + 0.07 * (1 - math.cos(t * math.pi / 2))
        c, b = cartridge(f"Belt round {i}", 0.0, 0.056, 0.0055, 0.0039, m, bullet_len=0.02, neck=0.0043, nose="spitzer", segs=12)
        for o in (c, b):
            move(o, (0, 0, -0.0))
            rotate(o, "y", -math.pi / 2, (0, 0, 0))
            move(o, (x + 0.028, y, 0.018 + (i % 2) * 0.0))
        link = box(f"Belt link {i}", (x, y - 0.003, 0.02), (0.012, 0.004, 0.012), m["black"], bevel=0.0005)
        belt += [c, b, link]
    belt_all = join("Belt", belt, pivot=(-0.03, 0.03, 0.02))
    ch = lathe("Charging handle", [(0, 0.0), (0.004, 0.0), (0.0045, 0.018), (0.006, 0.022), (0.006, 0.03), (0, 0.032)], m["black"], center=(0.012, 0.1), axis="x", segs=14)
    move(ch, (0.026, 0, 0))
    charging = join("Charging handle", [ch], pivot=(0.03, 0.012, 0.1))
    trigger = trigger_blade("Trigger", m["black"], -0.012, -0.034, 0.03)
    return {"muzzle": (0, by, L + 0.002), "hands": "rifle", "class": "belt-fed light machine gun",
            "animated": ["Feed cover", "Ammo box", "Belt", "Charging handle", "Trigger"]}


# ============================================================================= STICKMAN
@weapon("stick")
def stick():
    m = M()
    # handle passes through both shotgun-hand grips: wrist (z -0.14, y -0.03) and pump (z 0.27, y -0.02)
    y0, y1, z0, z1 = -0.031, -0.018, -0.32, 0.98
    def hy(z):
        return y0 + (y1 - y0) * (z - z0) / (z1 - z0)
    handle = loft("Stick handle", [(z, ellipse(2 * r, 2 * r, 20, 0, hy(z))) for z, r in
                                   ((z0, 0.011), (z0 + 0.01, 0.0135), (-0.2, 0.0142), (0.4, 0.0122), (0.8, 0.0098), (z1, 0.009))], m["walnut_dark"], sharp=70)
    wraps = [loft(f"Grip wrap {i}", [(z, ellipse(0.0332, 0.0332, 20, 0, hy(z))) for z in (a, b)], m["leather"], sharp=70)
             for i, (a, b) in enumerate(((-0.2, -0.09), (0.18, 0.36)))]
    ferrule = lathe("Brass ferrule", [(0, z0 - 0.006), (0.0118, z0 - 0.006), (0.0138, z0 + 0.004), (0.0138, z0 + 0.016), (0.0118, z0 + 0.02), (0, z0 + 0.02)], m["brass"],
                    center=(0, hy(z0)), segs=24)
    bands = [lathe(f"Inlay band {i}", [(0.0126 - i * 0.001, z - 0.004), (0.0132 - i * 0.001, z - 0.004), (0.0132 - i * 0.001, z + 0.004), (0.0126 - i * 0.001, z + 0.004)],
                   m["brass"], center=(0, hy(z)), segs=24, closed=True) for i, z in enumerate((0.45, 0.7))]
    mark = text("Stick mark", "STICKMAN · TABLE 3", (0.0, hy(0.58) + 0.0115, 0.58), 0.006, 0.0002, m["brass"], facing="+y")
    shaft = join("Stick", [handle, *wraps, ferrule, *bands, mark])
    # rake head: brass crossbar with three blunt rounded teeth, pointing down toward the felt
    hz, hyy = z1 + 0.004, hy(z1)
    socket = lathe("Head socket", [(0, hz - 0.03), (0.0098, hz - 0.03), (0.0118, hz - 0.012), (0.0118, hz + 0.008), (0, hz + 0.008)], m["brass"], center=(0, hyy), segs=24)
    bar = loft("Rake bar", [(x, rrect(0.02, 0.018, 0.006, 4, hz + 0.01, hyy - 0.004)) for x in (-0.075, 0.075)], m["brass"], along="x", sharp=40)
    caps = [lathe(f"Bar cap {s}", [(0, 0.0), (0.0095, 0.0), (0.0095, 0.004), (0, 0.006)], m["brass"], center=(hyy - 0.004, hz + 0.01), axis="x", segs=20)
            for s in (1, -1)]
    move(caps[0], (0.075, 0, 0))
    rotate(caps[1], "y", math.pi, (0, hyy - 0.004, hz + 0.01))
    move(caps[1], (-0.075, 0, 0))
    teeth = [loft(f"Tooth {i}", [(y, ellipse(0.016, 0.014, 18, x, hz + 0.012)) for y in (hyy - 0.012, hyy - 0.04)] +
                  [(hyy - 0.046, ellipse(0.012, 0.010, 18, x, hz + 0.012)), (hyy - 0.05, ellipse(0.004, 0.004, 18, x, hz + 0.012))], m["brass"], along="y", sharp=70)
             for i, x in enumerate((-0.055, 0.0, 0.055))]
    suit = text("Head suit", "♠ ♥ ♣", (0, hyy - 0.004, hz + 0.0195), 0.0085, 0.0003, m["silver"], facing="+z")
    head = join("Rake head", [socket, bar, *caps, *teeth, suit], pivot=(0, hyy, hz))
    head.scale = (1.35, 1.35, 1.35)
    bpy.context.view_layer.objects.active = head
    bpy.ops.object.select_all(action="DESELECT"); head.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    parent(head, shaft)
    return {"muzzle": (0, hyy - 0.03, hz + 0.02), "hands": "shotgun", "class": "craps stick (melee)", "animated": ["Stick", "Rake head"]}


# ============================================================================= FIRE EXIT
@weapon("axe")
def axe():
    m = M()
    y0, y1, z0, z1 = -0.031, -0.018, -0.26, 0.62
    def hy(z):
        return y0 + (y1 - y0) * (z - z0) / (z1 - z0)
    secs = [(z, ellipse(0.026 if z > 0.5 else 0.03, 0.04 if z > 0.5 else 0.046, 24, 0, hy(z), squash=1.3)) for z in (z0, z0 + 0.012, -0.2, 0.1, 0.45, 0.55, z1)]
    handle = loft("Handle wood", secs, m["red"], sharp=70)
    knob = loft("Handle knob", [(z0 - 0.02, ellipse(0.028, 0.048, 24, 0, hy(z0), squash=1.3)), (z0, ellipse(0.034, 0.054, 24, 0, hy(z0), squash=1.3)),
                                (z0 + 0.02, ellipse(0.03, 0.047, 24, 0, hy(z0), squash=1.3))], m["red"], sharp=70)
    # chipped paint shows bare hickory: shallow flat patches proud of the paint
    chips = []
    for i, (z, a) in enumerate(((-0.15, 0.4), (-0.05, 2.2), (0.12, 1.1), (0.21, 3.6), (0.33, 0.2), (-0.21, 2.8), (0.4, 4.6))):
        cx, cy = math.cos(a) * 0.0152, hy(z) + math.sin(a) * 0.0232
        chips.append(box(f"Chip {i}", (cx, cy, z), (0.006 if abs(math.cos(a)) < 0.7 else 0.0016, 0.0016 if abs(math.cos(a)) < 0.7 else 0.007, 0.007 + 0.005 * (i % 3)), m["hickory"], bevel=0.0006))
    label = loft("Safety label", [(z, ellipse(0.0308, 0.0468, 24, 0, hy(z), squash=1.3)) for z in (0.02, 0.085)], m["label"], sharp=70)
    label_t = text("Label text", "FIRE EXIT", (0.0158, hy(0.052), 0.052), 0.0085, 0.0002, m["black"], facing="+x")
    label_t2 = text("Label text 2", "EMERGENCY USE", (-0.0158, hy(0.052), 0.052), 0.0065, 0.0002, m["black"], facing="-x")
    wear = []
    shaft = join("Axe", [handle, knob, *chips, label, label_t, label_t2, *wear])
    # forged head: eye around the handle, blade down, pick up
    hz, hyy = 0.58, hy(0.58)
    eye = loft("Head eye", [(z, rrect(0.036, 0.062, 0.01, 4, 0, hyy)) for z in (hz - 0.032, hz + 0.032)], m["forged"], bevel=0.0015, sharp=40)
    blade_prof = rounded_polygon([(hz - 0.03, hyy - 0.02), (hz + 0.03, hyy - 0.02), (hz + 0.05, hyy - 0.1), (hz + 0.058, hyy - 0.15),
                                  (hz - 0.058, hyy - 0.15), (hz - 0.05, hyy - 0.1)], 0.004)
    blade = loft("Blade", [(x, blade_prof_shift) for x, blade_prof_shift in []], m["forged"]) if False else None
    secs = []
    for k, (x, sc) in enumerate(((-0.017, 1.0), (-0.008, 1.0), (0.0, 1.0), (0.008, 1.0), (0.017, 1.0))):
        pass
    blade = prism("Blade body", blade_prof, -0.015, 0.015, m["forged"], bevel=0.003, segments=3)
    edge = prism("Ground edge", rounded_polygon([(hz + 0.056, hyy - 0.14), (hz + 0.06, hyy - 0.158), (hz - 0.06, hyy - 0.158), (hz - 0.056, hyy - 0.14)], 0.002),
                 -0.004, 0.004, m["silver"], bevel=0.0012)
    pick = loft("Pick", [(y, rrect(w, w * 1.3, w * 0.4, 3, 0, hz)) for y, w in ((hyy + 0.02, 0.03), (hyy + 0.08, 0.02), (hyy + 0.13, 0.008), (hyy + 0.14, 0.003))],
                m["forged"], along="y", sharp=50)
    head_mark = text("Head mark", "HOUSE", (0.0152, hyy - 0.06, hz), 0.009, 0.0003, m["red"], facing="+x")
    head = join("Axe head", [eye, blade, edge, pick, head_mark], pivot=(0, hyy, hz))
    parent(head, shaft)
    return {"muzzle": (0, hyy - 0.15, hz), "hands": "shotgun", "class": "fire axe (melee)", "animated": ["Axe", "Axe head"]}


@weapon("fire-cabinet")
def fire_cabinet():
    """World display: red fire cabinet with a glass door (the axe GLB is mounted inside at runtime)."""
    m = M()
    red, glass = m["red"], flat_mat("Cabinet glass", (0.3, 0.38, 0.38), 0.0, 0.03, alpha=0.07)
    W, H, D = 1.05, 0.34, 0.12      # width (x), height (y), depth (z, out of the wall)
    back = box("Cabinet back", (0, 0, 0.005), (W, H, 0.01), red, bevel=0.002)
    sides = [box(f"Cabinet side {s}", (s * (W / 2 - 0.008), 0, D / 2), (0.016, H, D), red, bevel=0.003) for s in (1, -1)]
    tb = [box(f"Cabinet rail {s}", (0, s * (H / 2 - 0.008), D / 2), (W, 0.016, D), red, bevel=0.003) for s in (1, -1)]
    frame = [box(f"Door frame {i}", c, sz, m["black"], bevel=0.002) for i, (c, sz) in enumerate((((0, H / 2 - 0.02, D), (W - 0.02, 0.022, 0.012)), ((0, -H / 2 + 0.02, D), (W - 0.02, 0.022, 0.012)),
                                                                                                   ((W / 2 - 0.02, 0, D), (0.022, H - 0.02, 0.012)), ((-W / 2 + 0.02, 0, D), (0.022, H - 0.02, 0.012))))]
    pane = box("Glass pane", (0, 0, D), (W - 0.05, H - 0.05, 0.003), glass, bevel=0)
    sign = box("Sign plate", (0, H / 2 + 0.045, 0.004), (0.46, 0.07, 0.008), m["label"], bevel=0.002)
    sign_t = text("Sign text", "FIRE EXIT · BREAK GLASS", (0, H / 2 + 0.045, 0.0085), 0.034, 0.0006, m["black"], facing="+z")
    hammer_ = box("Glass hammer", (W / 2 + 0.05, 0.0, 0.02), (0.02, 0.12, 0.02), m["forged"], bevel=0.002)
    cab = join("Fire cabinet", [back, *sides, *tb, *frame, pane, sign, sign_t, hammer_], pivot=(0, 0, 0))
    return {"hands": None, "class": "world display", "animated": []}


# ============================================================================= driver
def run(ids):
    manifest_path = DOC / "asset-manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for wid in ids:
        reset_scene()
        col = start(wid)
        meta = BUILDERS[wid]()
        finalize_uvs()
        objs = list(col.all_objects)
        tris = stats(objs)
        export_glb(OUT / f"{wid}.glb", objs)
        # Neutral studio camera + three-quarter preview saved inside the .blend.
        studio(objs, DOC / f"{wid}-three.png", "three", res=(1400, 900))
        studio(objs, DOC / f"{wid}-side.png", "side", res=(1600, 900))
        bpy.ops.wm.save_as_mainfile(filepath=str(SRC / f"{wid}.blend"), compress=True)
        bpy.ops.file.make_paths_relative()
        bpy.ops.wm.save_as_mainfile(filepath=str(SRC / f"{wid}.blend"), compress=True)
        nodes = sorted(o.name for o in objs)
        meta.update({"triangles": tris, "nodes": nodes, "glb": f"public/models/{wid}.glb",
                     "source": f"assets/source/weapons-1970s/{wid}.blend", "bytes": (OUT / f"{wid}.glb").stat().st_size})
        manifest[wid] = meta
        print(f"BUILT {wid}: {tris} tris, {len(nodes)} nodes, {meta['bytes']} bytes")
    manifest_path.write_text(json.dumps(manifest, indent=1, default=list))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    run(argv or list(BUILDERS))
