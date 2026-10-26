"""Original hotel model authoring helpers. Inputs use the game's X/Y-up/Z frame."""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector, Matrix
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/hotel-assets/lobby';DOC.mkdir(parents=True,exist_ok=True)
PARTS=[]
def xyz(p):return (p[0],-p[2],p[1])
def reset():
    PARTS.clear();bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.data.orphans_purge(do_recursive=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene.unit_settings.system='METRIC'
def material(name,hex,rough=.5,metal=0,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    rgb=[int(hex[i:i+2],16)/255 for i in (1,3,5)]
    rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission:p.inputs['Emission Color'].default_value=(*rgb,1);p.inputs['Emission Strength'].default_value=emission
    return m

def palette():
    return dict(ivory=material('Hotel carved ivory','#ded1b6',.62),stone=material('Hotel honed limestone','#c8bea6',.49),green=material('Hotel forest enamel','#304a3f',.34),wood=material('Hotel satin walnut','#65452f',.32),gold=material('Hotel satin champagne brass','#b8a277',.34,.72),dark=material('Hotel dark bronze','#514638',.42,.6),opal=material('Hotel warm opal','#ffe2ad',.24,0,1.6),crystal=material('Hotel faceted crystal','#c6d5ce',.12,.25),fabric=material('Hotel forest velvet','#35584a',.8))
def texture(m,kind):
    n=512;y,x=np.mgrid[0:n,0:n];rng=np.random.default_rng(1896)
    m['hotel_surface']=kind
    if kind=='wood':
        phase=x*.50+np.sin(y*math.tau/n)*1.4+np.sin(y*math.tau*3/n)*.3
        grain=np.sin(phase)*.033+np.sin(phase*2.01)*.012
        pores=np.maximum(0,np.sin(phase*3.1))**18
        value=.82+grain-pores*.025+rng.normal(0,.003,(n,n))
        rgb=np.stack([value*.49,value*.32,value*.20],axis=2)
        rough=.32+pores*.07+grain*.4
        height=np.sin(phase)*.22-pores*.15
    elif kind=='brass':
        u=x/(n-1);v=y/(n-1)
        edge=1-np.sin(u*math.pi)**.4*np.sin(v*math.pi)**.4
        mottling=(np.sin(x*.063)*np.sin(y*.073)+1)*.5
        tarnish=np.clip(edge*.42+mottling*.10,0,.55)
        # Recess/edge tarnish around a handled, slightly brighter central field.
        rgb=np.stack([.72-tarnish*.23,.635-tarnish*.27,.467-tarnish*.24],axis=2)
        rough=.27+tarnish*.43+rng.random((n,n))*.018
        height=None
    else:
        warp=np.sin(x*math.pi/2);weft=np.sin(y*math.pi/2)
        value=.82+.017*warp*weft+rng.normal(0,.004,(n,n))
        rgb=np.stack([value*.24,value*.36,value*.29],axis=2)
        rough=.80+.045*warp*weft
        height=warp*weft*.22
    def packed(suffix,data,linear=False):
        pixels=np.ones((n,n,4),np.float32);pixels[:,:,:3]=np.clip(data,0,1)
        im=bpy.data.images.new(m.name+' '+suffix,n,n)
        if linear:im.colorspace_settings.name='Non-Color'
        im.pixels.foreach_set(pixels.ravel());im.pack();return im
    nodes=m.node_tree.nodes;links=m.node_tree.links;bsdf=nodes.get('Principled BSDF')
    for suffix,data,target,linear in [('original color',rgb,'Base Color',False),('surface roughness',np.repeat(rough[:,:,None],3,axis=2),'Roughness',True)]:
        node=nodes.new('ShaderNodeTexImage');node.image=packed(suffix,data,linear);links.new(node.outputs['Color'],bsdf.inputs[target])
    if height is not None:
        dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*.5
        dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*.5
        normal=np.stack([-dx,-dy,np.ones_like(dx)],axis=2);normal/=np.linalg.norm(normal,axis=2)[:,:,None]
        node=nodes.new('ShaderNodeTexImage');node.image=packed('fine tangent normal',normal*.5+.5,True)
        convert=nodes.new('ShaderNodeNormalMap');convert.inputs['Strength'].default_value=.24 if kind=='wood' else .32
        links.new(node.outputs['Color'],convert.inputs['Color']);links.new(convert.outputs['Normal'],bsdf.inputs['Normal'])
    bsdf.inputs['Base Color'].default_value=(1,1,1,1)
def add(o,name,m,bevel=0,smooth=False):
    o.name=name;o.data.materials.append(m);PARTS.append(o)
    if o.type=='MESH':
        if bevel:
            mod=o.modifiers.new('Manufactured edge radius','BEVEL');mod.width=bevel;mod.segments=3
            mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True
        for f in o.data.polygons:f.use_smooth=smooth
        uv=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap')
        spans=[max(v.co[i] for v in o.data.vertices)-min(v.co[i] for v in o.data.vertices) for i in range(3)]
        for f in o.data.polygons:
            axes=[i for i in range(3) if i!=max(range(3),key=lambda i:abs(f.normal[i]))]
            if m.get('hotel_surface')=='wood':axes.sort(key=lambda i:spans[i])
            for li in f.loop_indices:
                v=o.data.vertices[o.data.loops[li].vertex_index].co
                if m.get('hotel_surface')=='brass':
                    uv.data[li].uv=tuple((v[a]-min(vv.co[a] for vv in o.data.vertices))/max(spans[a],.001) for a in axes)
                else:
                    scale=6.25 if m.get('hotel_surface')=='fabric' else 1
                    uv.data[li].uv=(v[axes[0]]*scale,v[axes[1]]*scale)
    return o

def box(name,p,size,m,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return add(o,name,m,min(bevel,min(size)*.24))
def mesh(name,vertices,faces,m,bevel=0,smooth=False):
    me=bpy.data.meshes.new(name);me.from_pydata([xyz(p) for p in vertices],[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return add(o,name,m,bevel,smooth)
def line(name,points,r,m,res=2):
    if m.get('hotel_surface')=='wood':
        # Sweep UVs along arc length: walnut grain follows the curved handrail.
        n=16;vertices=[];uvs=[];distance=0
        for j,p in enumerate(points):
            if j:distance+=(Vector(p)-Vector(points[j-1])).length
            tangent=(Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])).normalized()
            across=tangent.cross(Vector((0,1,0))).normalized();up=tangent.cross(across).normalized()
            for i in range(n+1):
                a=math.tau*i/n;vertices.append(tuple(Vector(p)+r*(math.cos(a)*across+math.sin(a)*up)))
                uvs.append((math.tau*r*i/n,distance))
        faces=[]
        for j in range(len(points)-1):
            for i in range(n):
                k=j*(n+1)+i;faces.append((k,k+1,k+n+2,k+n+1))
        faces.extend([tuple(reversed(range(n))),tuple((len(points)-1)*(n+1)+i for i in range(n))])
        o=mesh(name,vertices,faces,m,smooth=True)
        for loop in o.data.loops:o.data.uv_layers.active.data[loop.index].uv=uvs[loop.vertex_index]
        return o
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=res;c.use_fill_caps=True
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*xyz(v),1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);return add(o,name,m)
def rod(name,a,b,r,m,n=16,r2=None):
    a,b=Vector(xyz(a)),Vector(xyz(b));bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return add(o,name,m,0,True)
def sphere(name,p,size,m,segments=20,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=xyz(p));o=bpy.context.object;o.scale=(size[0]/2,size[2]/2,size[1]/2);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return add(o,name,m,0,True)
def lathe(name,x,z,profile,m,n=32,flutes=0):
    vertices=[]
    for y,r in profile:
        for i in range(n):
            a=i*math.tau/n;rr=r+flutes*math.cos(a*16);vertices.append((x+math.cos(a)*rr,y,z+math.sin(a)*rr))
    faces=[]
    for j in range(len(profile)-1):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    faces.extend([tuple(reversed(range(n))),tuple((len(profile)-1)*n+i for i in range(n))])
    return mesh(name,vertices,faces,m,smooth=True)
def export(name):
    source=ROOT/'assets/source'/f'{name}.blend';source.parent.mkdir(parents=True,exist_ok=True)
    bpy.context.scene['authorship']='Original Grand Hotel assets; editable named parts; metre scale'
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();groups={};reflection=Matrix.Diagonal((-1.,1.,1.,1.))
    for original in PARTS:
        me=bpy.data.meshes.new_from_object(original.evaluated_get(deps),depsgraph=deps);me.transform(reflection@original.matrix_world)
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
        o=bpy.data.objects.new(original.name+' export',me);bpy.context.collection.objects.link(o);groups.setdefault(original.data.materials[0].name,[]).append(o)
    exported=[]
    for name_,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name=name+' / '+name_;exported.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in exported:o.select_set(True)
    path=ROOT/'public/models'/f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
    triangles=0
    for o in exported:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
    report={'asset':path.name,'editableParts':len(PARTS),'materialMeshes':len(exported),'triangles':triangles,'bytes':path.stat().st_size}
    (DOC/f'{name}-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print('LOBBY_ASSET',json.dumps(report),flush=True)
    for o in exported:bpy.data.objects.remove(o,do_unlink=True)
    return report
