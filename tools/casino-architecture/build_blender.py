"""Original Art Deco casino perimeter and three coordinated room gates.
Run export-layout.mjs first, then Blender --background --python this_file.py.
"""
import sys, json, math
from pathlib import Path
import bpy, bmesh
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/hotel-assets'))
import build_entry as d
DOC=ROOT/'docs/casino-architecture'; OUT=ROOT/'public/models'
layout=json.loads((DOC/'layout.json').read_text())
d.PARTS={}; placements={}

def group(name,placement):
    d.GROUP=name;d.PARTS[name]=[];placements[name]=placement

def wall_courses(start,end):
    center=(start+end)/2;span=end-start
    for y,h,depth,m in [(.10,.20,.51,d.STONE),(.245,.07,.55,d.MARBLE),(1.32,.085,.53,d.WALNUT),(1.40,.045,.55,d.GOLD),(6.30,.12,.52,d.STONE),(6.43,.10,.56,d.STONE),(6.53,.10,.66,d.MARBLE),(6.62,.06,.72,d.GOLD),(6.73,.14,.78,d.STONE)]:
        d.box('Continuous casino wall course',(center,y,-.25),(span,h,depth),m,.006)
    d.box('Recessed warm cove',(center,6.382,-.549),(span,.018,.025),d.OPAL,.003)

def bays(start,end):
    count=max(1,round((end-start)/3.03));step=(end-start)/count
    for i in range(count):
        d.decorate_wall_bay(start+(i+.5)*step,step)
        if i%3==1:d.wall_sconce(start+i*step)

for wall in layout['walls']:
    group(wall['id'],wall)
    length=wall['length'];a=-length/2;b=length/2
    d.box('Casino wall structural backing',(0,3.4,-.25),(length,6.8,.45),d.PLASTER,0)
    wall_courses(a,b)
    a+=wall['trimStart'];b-=wall['trimEnd'];feature=wall['featureX']
    if feature is None:bays(a,b)
    else:
        bays(a,feature-4);bays(feature+4,b)
        # Quiet, purpose-made sign bay instead of text overlapping panel reliefs.
        d.box('Grand Casino feature field',(feature,3.84,-.491),(7.86,4.59,.04),d.OXBLOOD,.008)
        d.stepped_border('Feature stepped stone surround',feature,3.84,-.538,7.7,4.40,.22,.019,d.STONE)
        d.stepped_border('Feature inner champagne bead',feature,3.84,-.568,7.48,4.18,.20,.011,d.GOLD)
        d.cast_fan('Grand Casino crest',feature,5.05,-.591,.81,.73)
        d.box('Casino name enamel',(feature,4.03,-.563),(6.6,1.03,.06),d.PLASTER,.026)
        d.border('Casino name bronze frame',feature,4.03,-.602,6.48,.91,.020,d.BRONZE)
        d.text('Grand Casino raised name','LAST JACKPOT',(feature,4.10,-.613),.50)
        d.text('Grand Casino raised subtitle','THE GRAND CASINO',(feature,3.10,-.556),.25)
        # The pistol-ammunition display below remains accessible and unobscured.
        d.box('Feature walnut dado',(feature,.78,-.49),(7.87,.95,.055),d.WALNUT,.008)
    # The shared bay authoring uses hotel-local Z=-.25; the wall origin is Z=0.
    for o in d.PARTS[d.GROUP]:o.location.y-=.25

for style,title in [('lounge','THE LAST CALL'),('vip','HIGH ROLLER CLUB'),('cashier','CASHIER')]:
    placement=next(p for p in layout['portals'] if p['style']==style)
    group('portal-'+style,placement)
    for side in [-1,1]:
        x=side*2.21
        d.box('Portal stone jamb',(x+side*.025,2,0),(.37,4,.66),d.MARBLE,.014)
        d.box('Portal plinth',(x,.13,0),(.42,.26,.75),d.STONE,.012)
        d.box('Portal bronze shoe',(x,.028,0),(.42,.056,.76),d.BRONZE,.005)
        for face in [-1,1]:
            for dx in [-.115,-.057,0,.057,.115]:
                d.box('Portal bronze fluting',(x+dx,2.15,face*.353),(.014,3.41,.025),d.BRONZE,.003)
            for y in [.34,3.86]:d.box('Portal stepped capital',(x,y,face*.014),(.41,.10,.73),d.STONE,.008)
            d.box('Jamb lantern escutcheon',(x,2.59,face*.381),(.25,.64,.065),d.BRONZE,.024)
            d.box('Jamb opal lantern',(x,2.59,face*.442),(.18,.48,.083),d.OPAL,.017)
            for dx in [-.088,0,.088]:d.box('Jamb lantern cage',(x+dx,2.59,face*.494),(.012,.50,.021),d.BRONZE,.003)
            for y in [2.31,2.87]:d.box('Jamb lantern cap',(x,y,face*.439),(.28,.07,.16),d.GOLD,.012)
    d.box('Full-height portal transom',(0,5.4,0),(4.84,2.8,.64),d.STONE,.010)
    # Front crown matches the hotel; a lower finished return sits below the side-room ceiling.
    for y,h,w,depth,m in [(4.08,.10,4.89,.73,d.MARBLE),(4.2,.07,4.94,.78,d.GOLD),(4.83,.10,4.95,.76,d.STONE),(4.94,.09,5.0,.82,d.MARBLE),(6.43,.10,4.91,.82,d.STONE),(6.53,.10,4.96,.92,d.MARBLE),(6.62,.06,5,.98,d.GOLD),(6.73,.14,5.04,1.04,d.STONE)]:
        d.box('Portal continuous moulding',(0,y,0),(w,h,depth),m,.009)
    for face in [-1,1]:
        before=len(d.PARTS[d.GROUP])
        d.box('Room name oxblood enamel',(0,4.48,-.339),(3.90,.48,.039),d.OXBLOOD,.012)
        d.stepped_border('Room name frame',0,4.48,-.371,3.80,.42,.065,.012,d.GOLD)
        d.text('Room raised name',title if face==-1 else 'GRAND CASINO',(0,4.48,-.389),.26 if style=='vip' or face==1 else .30)
        if face==1:
            bpy.context.view_layer.update()
            for o in d.PARTS[d.GROUP][before:]:o.matrix_world=Matrix.Rotation(math.pi,4,'Z')@o.matrix_world
    d.box('Portal upper oxblood field',(0,5.69,-.332),(4.46,1.36,.045),d.OXBLOOD,.008)
    d.stepped_border('Portal upper geometric frame',0,5.69,-.374,4.24,1.17,.12,.013,d.GOLD)
    d.cast_fan('Portal cast sunrise',0,5.21,-.40,.88,.86)
    for side in [-1,1]:
        for y,w in [(5.30,.64),(5.46,.49),(5.62,.34)]:d.box('Transom wing motif',(side*1.50,y,-.386),(w,.022,.025),d.GOLD,.003)
    d.box('Portal warm cove',(0,6.382,-.43),(5.04,.018,.025),d.OPAL,.003)
    group('gate-'+style,placement)
    # Two framed leaves; distinct room motifs share dimensions and materials.
    for side in [-1,1]:
        x=side*.996
        for px in [side*.022,side*1.973]:d.box('Gate leaf vertical frame',(px,2,0),(.042,3.94,.11),d.BRONZE,.006)
        for y in [.056,.81,2.55,3.966]:d.box('Gate leaf horizontal frame',(x,y,0),(1.97,.047,.11),d.BRONZE,.006)
        d.box('Gate lower oxblood panel',(x,.43,0),(1.90,.70,.061),d.OXBLOOD,.007)
        for face in [-1,1]:
            d.stepped_border('Gate kick panel inlay',x,.43,face*.043,1.74,.55,.08,.010,d.GOLD)
            d.box('Gate lock escutcheon',(side*.105,1.35,face*.069),(.13,.35,.03),d.BRONZE,.010)
            d.line('Gate pull handle',[(side*.105,1.23,face*.085),(side*.105,1.25,face*.14),(side*.105,1.45,face*.14),(side*.105,1.47,face*.085)],.015,d.GOLD)
        spacing=13 if style=='cashier' else 7
        for dx in d.np.linspace(-.87,.87,spacing):d.rod('Gate vertical bronze bar',(x+float(dx),.82,0),(x+float(dx),3.94,0),.013,d.GOLD)
        if style=='cashier':
            for y in d.np.arange(1.02,3.83,.29):d.box('Cashier security weave',(x,float(y),-.017),(1.90,.018,.019),d.BRONZE,.002)
        elif style=='lounge':
            d.cast_fan('Last Call gate fan',x,2.73,-.045,.74,.98)
            for y in [1.15,2.17]:
                d.line('Lounge gate chevron',[(x-.79,y+.25,-.027),(x,y,-.027),(x+.79,y+.25,-.027)],.017,d.BRONZE)
        else:
            for y,rx,ry in [(1.34,.61,.46),(2.20,.61,.46),(3.32,.73,.51)]:
                d.line('High Roller diamond',[(x-rx,y,-.030),(x,y+ry,-.030),(x+rx,y,-.030),(x,y-ry,-.030),(x-rx,y,-.030)],.019,d.GOLD)
    for side in [-1,1]:
        for y in [.48,1.96,3.45]:d.rod('Gate barrel hinge',(side*1.978,y-.075,.012),(side*1.978,y+.075,.012),.029,d.BRONZE)
    d.box('Gate purchase plaque',(0,1.65,0),(2.91,.50,.22),d.OXBLOOD,.016)
    for face in [-1,1]:d.border('Gate purchase rim',0,1.65,face*.121,2.84,.43,.012,d.GOLD)

# Export local geometry, batched by material; runtime supplies the exact shared layout.
reflection=Matrix.Diagonal((-1.,1.,1.,1.));reports=[]
def reverse(me):
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
for kind,objects in d.PARTS.items():
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();groups={}
    for original in objects:
        me=bpy.data.meshes.new_from_object(original.evaluated_get(deps),depsgraph=deps)
        if original.type=='FONT':me.transform(reflection);reverse(me)
        me.transform(reflection@original.matrix_world);reverse(me)
        copy=bpy.data.objects.new(original.name+' export',me);bpy.context.collection.objects.link(copy)
        groups.setdefault(original.data.materials[0].name,[]).append(copy)
    exported=[]
    for name,obs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]
        if len(obs)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name=kind+' / '+name;exported.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in exported:o.select_set(True)
    bpy.context.view_layer.objects.active=exported[0]
    path=OUT/('casino-deco-'+kind+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
    triangles=0
    for o in exported:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
    reports.append({'asset':path.name,'triangles':triangles,'meshes':len(exported),'bytes':path.stat().st_size})
    for o in exported:bpy.data.objects.remove(o,do_unlink=True)
(DOC/'asset-report.json').write_text(json.dumps(reports,indent=2)+'\n')
# Editable source uses actual game placements; duplicate the shared room variants.
for kind,objects in d.PARTS.items():
    p=placements[kind];matches=[p]
    if kind.startswith(('gate-','portal-')):matches=[q for q in layout['portals'] if q['style']==p['style']]
    for index,q in enumerate(matches):
        matrix=Matrix.Translation(Vector(d.xyz((q['x'],0,q['z']))))@Matrix.Rotation(q['yaw'],4,'Z')
        for original in objects:
            if index==0:continue
            o=original.copy();o.data=original.data.copy();bpy.context.collection.objects.link(o);o.matrix_world=matrix@original.matrix_world
    matrix=Matrix.Translation(Vector(d.xyz((p['x'],0,p['z']))))@Matrix.Rotation(p['yaw'],4,'Z')
    for o in objects:o.matrix_world=matrix@o.matrix_world
bpy.context.scene['authorship']='Original cohesive smoky oxblood Art Deco casino architecture'
bpy.context.scene['layout']='Exact runtime placement; 4m clear room portals; fixed transoms meet 6.8m casino ceiling'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/casino-architecture.blend'))
# Detail study of the south portals; staging is not part of the editable architecture.
d.GROUP=next(iter(d.PARTS))
d.box('Preview floor',(-3,-.055,-4),(72,.09,54),d.STONE,0)
for name,power,position,size in [('Key',3200,(-18,9,-10),11),('Fill',2500,(3,7,-8),10)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=d.xyz(position);o.rotation_euler=(Vector(d.xyz((-18,3,-20)))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=d.xyz((-14,6,-6)));camera=bpy.context.object
camera.rotation_euler=(Vector(d.xyz((-18,3.4,-20)))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=23
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=950;scene.render.resolution_percentage=100;scene.world.color=(.13,.13,.13)
scene.render.filepath=str(DOC/'blender-preview.png');bpy.ops.render.render(write_still=True)
print('CASINO_ARCHITECTURE_COMPLETE',json.dumps(reports))
