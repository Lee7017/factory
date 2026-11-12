// @ts-nocheck
import { useEffect, useRef } from "react"
import * as THREE from "three"

type AgentMap3DProps={selectedId:string}

type DeptScene={
  id:string
  pos:[number,number]
  accent:number
  height:number
  style:"office"|"tower"|"warehouse"|"factory"|"lab"|"finance"
}

const DEPTS:DeptScene[]=[
  {id:"sales",pos:[-9,5.2],accent:0x65a568,height:3.1,style:"office"},
  {id:"pmc",pos:[-4.8,7.0],accent:0x5e986c,height:4.3,style:"tower"},
  {id:"hr",pos:[0,8.6],accent:0x84a47c,height:3.8,style:"office"},
  {id:"purchase",pos:[5.0,7.0],accent:0x7da778,height:3.4,style:"warehouse"},
  {id:"warehouse",pos:[9.2,3.4],accent:0x638b76,height:3.1,style:"warehouse"},
  {id:"quality",pos:[6.0,-4.7],accent:0x759b82,height:3.5,style:"lab"},
  {id:"finance",pos:[0.6,-7.0],accent:0x78946a,height:3.6,style:"finance"},
  {id:"production",pos:[-6.6,-4.8],accent:0x628a70,height:3.25,style:"factory"},
]

const LABELS:Record<string,string>={sales:"销售",pmc:"PMC",purchase:"采购",warehouse:"仓库",production:"生产",quality:"质量",finance:"财务",hr:"人事"}

function roundedCanvasTexture(text:string,accent:string){
  const canvas=document.createElement("canvas")
  canvas.width=512
  canvas.height=160
  const ctx=canvas.getContext("2d")!
  ctx.clearRect(0,0,canvas.width,canvas.height)
  ctx.fillStyle="rgba(24,55,39,.96)"
  ctx.beginPath()
  ctx.roundRect(12,12,488,136,34)
  ctx.fill()
  ctx.strokeStyle=accent
  ctx.lineWidth=8
  ctx.stroke()
  ctx.font='800 72px "PingFang SC","Microsoft YaHei",sans-serif'
  ctx.textAlign="center"
  ctx.textBaseline="middle"
  ctx.fillStyle="#f5fff7"
  ctx.fillText(text,256,83)
  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  texture.anisotropy=4
  texture.needsUpdate=true
  return texture
}

function box(group:THREE.Group,size:[number,number,number],pos:[number,number,number],material:THREE.Material,cast=true,receive=true){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material)
  mesh.position.set(...pos)
  mesh.castShadow=cast
  mesh.receiveShadow=receive
  group.add(mesh)
  return mesh
}

function addWindows(group:THREE.Group,w:number,h:number,d:number,rows:number){
  const glass=new THREE.MeshStandardMaterial({color:0x93cbd1,roughness:.24,metalness:.08,emissive:0x173f43,emissiveIntensity:.22})
  const frame=new THREE.MeshStandardMaterial({color:0x56665f,roughness:.68,metalness:.18})
  const cols=3
  for(let r=0;r<rows;r++){
    const y=.8+r*.78
    for(let c=0;c<cols;c++){
      const x=-w*.28+c*w*.28
      box(group,[w*.19,.48,.06],[x,y,d/2+.035],glass,false,false)
      box(group,[.035,.54,.08],[x+w*.105,y,d/2+.04],frame,false,false)
    }
    for(let c=0;c<2;c++){
      const z=-d*.2+c*d*.4
      box(group,[.06,.48,d*.23],[w/2+.035,y,z],glass,false,false)
    }
  }
}

function addRooftopDetail(group:THREE.Group,style:DeptScene["style"],roofY:number,accentMat:THREE.Material){
  const metal=new THREE.MeshStandardMaterial({color:0x7c8780,roughness:.52,metalness:.55})
  const dark=new THREE.MeshStandardMaterial({color:0x3f5047,roughness:.62,metalness:.28})
  const gold=new THREE.MeshStandardMaterial({color:0xd6a735,roughness:.34,metalness:.62,emissive:0x5a3b00,emissiveIntensity:.12})
  if(style==="factory"){
    for(const x of [-.65,.05]){
      const stack=new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,1.35,18),metal)
      stack.position.set(x,roofY+.72,-.15)
      stack.castShadow=true
      group.add(stack)
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.1,18),dark)
      cap.position.set(x,roofY+1.42,-.15)
      group.add(cap)
    }
  }else if(style==="warehouse"){
    for(let i=0;i<3;i++) box(group,[.62,.3,.52],[-.85+i*.85,roofY+.2,-.25],i===1?accentMat:metal)
  }else if(style==="lab"){
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.42,.55,.28,24),metal)
    base.position.set(.65,roofY+.18,0)
    group.add(base)
    const vent=new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,.7,20),dark)
    vent.position.set(.65,roofY+.62,0)
    vent.castShadow=true
    group.add(vent)
  }else if(style==="finance"){
    for(let i=0;i<3;i++){
      const coin=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.15,28),gold)
      coin.rotation.x=Math.PI/2
      coin.position.set(.55,roofY+.18+i*.16,-.1)
      coin.castShadow=true
      group.add(coin)
    }
  }else{
    box(group,[.9,.3,.7],[.55,roofY+.18,-.15],metal)
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1.15,10),dark)
    mast.position.set(-.6,roofY+.65,.05)
    group.add(mast)
    const dish=new THREE.Mesh(new THREE.SphereGeometry(.26,18,10,0,Math.PI*2,0,Math.PI/2),accentMat)
    dish.rotation.z=-.6
    dish.position.set(-.48,roofY+1.08,.05)
    group.add(dish)
  }
}

function createBuilding(def:DeptScene){
  const group=new THREE.Group()
  group.position.set(def.pos[0],0,def.pos[1])
  const accent=new THREE.Color(def.accent)
  const wall=new THREE.MeshStandardMaterial({color:0xe9ece7,roughness:.72,metalness:.06})
  const side=new THREE.MeshStandardMaterial({color:0xcbd3cc,roughness:.76,metalness:.08})
  const accentMat=new THREE.MeshStandardMaterial({color:def.accent,roughness:.58,metalness:.12})
  const roof=new THREE.MeshStandardMaterial({color:accent.clone().multiplyScalar(.86),roughness:.64,metalness:.12})
  const concrete=new THREE.MeshStandardMaterial({color:0xbfc5bc,roughness:.9})
  const w=def.style==="warehouse"?4.1:def.style==="factory"?3.8:3.35
  const d=def.style==="warehouse"?3.0:2.75
  const h=def.height

  box(group,[w+1,.16,d+1],[0,.08,0],concrete,false,true)
  box(group,[w,h,d],[0,h/2+.16,0],wall,true,true)
  box(group,[.14,h-.2,d-.08],[w/2+.07,h/2+.14,0],side,false,true)
  box(group,[w+.22,.25,d+.22],[0,h+.27,0],roof,true,true)
  box(group,[w*.72,.12,d*.68],[0,h+.47,0],accentMat,true,true)
  addWindows(group,w,h,d,Math.max(2,Math.floor(h/.95)))

  const entranceGlass=new THREE.MeshStandardMaterial({color:0x75b9c4,roughness:.18,metalness:.14,transparent:true,opacity:.86,emissive:0x102d31,emissiveIntensity:.26})
  box(group,[.74,1.15,.08],[-.25,.76,d/2+.05],entranceGlass,false,false)
  box(group,[.5,.16,.65],[.72,.18,d/2+.35],accentMat,true,true)

  const signTexture=roundedCanvasTexture(LABELS[def.id],"#d9bd53")
  const signMat=new THREE.MeshBasicMaterial({map:signTexture,transparent:true,toneMapped:false})
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.7,.54),signMat)
  sign.position.set(0,h+.82,d/2+.03)
  group.add(sign)

  addRooftopDetail(group,def.style,h+.5,accentMat)

  const ringMat=new THREE.MeshBasicMaterial({color:0x68e58b,transparent:true,opacity:0,depthWrite:false,toneMapped:false})
  const ring=new THREE.Mesh(new THREE.RingGeometry(2.15,2.28,64),ringMat)
  ring.rotation.x=-Math.PI/2
  ring.position.y=.12
  group.add(ring)
  group.userData.selectionRing=ring
  group.userData.signTexture=signTexture
  return group
}

function createTree(x:number,z:number,scale=1,pine=false){
  const group=new THREE.Group()
  group.position.set(x,0,z)
  group.scale.setScalar(scale)
  const trunkMat=new THREE.MeshStandardMaterial({color:0x73543b,roughness:.95})
  const leafMat=new THREE.MeshStandardMaterial({color:pine?0x356b48:0x5f974f,roughness:.9})
  const leafLight=new THREE.MeshStandardMaterial({color:pine?0x477f54:0x86b868,roughness:.9})
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.17,1.25,10),trunkMat)
  trunk.position.y=.62
  trunk.castShadow=true
  group.add(trunk)
  if(pine){
    for(const [y,r] of [[1.1,.76],[1.55,.62],[1.95,.46]] as [number,number][]){
      const crown=new THREE.Mesh(new THREE.ConeGeometry(r,1.3,10),y>1.5?leafLight:leafMat)
      crown.position.y=y
      crown.castShadow=true
      group.add(crown)
    }
  }else{
    for(const [px,py,pz,r,light] of [[-.38,1.55,0,.55,0],[.36,1.58,.05,.62,1],[0,1.95,0,.68,0],[-.05,2.12,-.18,.48,1]] as [number,number,number,number,number][]){
      const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),light?leafLight:leafMat)
      crown.position.set(px,py,pz)
      crown.castShadow=true
      crown.receiveShadow=true
      group.add(crown)
    }
  }
  return group
}

function createLamp(x:number,z:number){
  const g=new THREE.Group()
  g.position.set(x,0,z)
  const metal=new THREE.MeshStandardMaterial({color:0x35483e,roughness:.46,metalness:.55})
  const warm=new THREE.MeshStandardMaterial({color:0xffe39a,roughness:.25,emissive:0xffb547,emissiveIntensity:1.4})
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,1.7,10),metal)
  pole.position.y=.85
  g.add(pole)
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),warm)
  lamp.position.y=1.72
  g.add(lamp)
  return g
}

function road(scene:THREE.Scene,w:number,d:number,x:number,z:number,rot=0){
  const asphalt=new THREE.MeshStandardMaterial({color:0x5d625f,roughness:.96,metalness:.02})
  const curb=new THREE.MeshStandardMaterial({color:0xc8cbc4,roughness:.88})
  const r=new THREE.Mesh(new THREE.BoxGeometry(w,.08,d),asphalt)
  r.position.set(x,.055,z)
  r.rotation.y=rot
  r.receiveShadow=true
  scene.add(r)
  const c1=new THREE.Mesh(new THREE.BoxGeometry(w+.16,.055,.13),curb)
  const c2=c1.clone()
  c1.position.set(x,.1,z-d/2)
  c2.position.set(x,.1,z+d/2)
  c1.rotation.y=c2.rotation.y=rot
  scene.add(c1,c2)
}

function lineTube(a:THREE.Vector3,b:THREE.Vector3){
  const mid=a.clone().lerp(b,.5)
  mid.y=.18
  const curve=new THREE.CatmullRomCurve3([a,new THREE.Vector3(mid.x,.22,mid.z),b])
  const mat=new THREE.MeshBasicMaterial({color:0x52e3ed,transparent:true,opacity:.52,toneMapped:false})
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.035,8,false),mat)
  mesh.userData.curve=curve
  return mesh
}

export function AgentMap3D({selectedId}:AgentMap3DProps){
  const hostRef=useRef<HTMLDivElement|null>(null)
  const selectedRef=useRef(selectedId)
  selectedRef.current=selectedId

  useEffect(()=>{
    const host=hostRef.current
    if(!host) return
    host.replaceChildren()

    const scene=new THREE.Scene()
    scene.background=new THREE.Color(0xcbdcc6)
    scene.fog=new THREE.Fog(0xcbdcc6,25,46)

    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"})
    renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.toneMapping=THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure=1.12
    renderer.shadowMap.enabled=true
    renderer.shadowMap.type=THREE.PCFSoftShadowMap
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2))
    renderer.domElement.className="agent-three-canvas"
    host.appendChild(renderer.domElement)

    const camera=new THREE.OrthographicCamera(-18,18,12,-12,.1,100)
    camera.position.set(19,23,23)
    camera.lookAt(0,1.2,0)
    camera.zoom=1.03
    camera.updateProjectionMatrix()

    const hemi=new THREE.HemisphereLight(0xeaf6ff,0x738865,2.0)
    scene.add(hemi)
    const sun=new THREE.DirectionalLight(0xfff2ce,3.2)
    sun.position.set(-11,22,13)
    sun.castShadow=true
    sun.shadow.mapSize.set(2048,2048)
    sun.shadow.camera.left=-22
    sun.shadow.camera.right=22
    sun.shadow.camera.top=18
    sun.shadow.camera.bottom=-18
    sun.shadow.camera.near=1
    sun.shadow.camera.far=60
    sun.shadow.bias=-.0005
    sun.shadow.normalBias=.035
    scene.add(sun)
    const fill=new THREE.DirectionalLight(0x99cbd5,.72)
    fill.position.set(15,10,-12)
    scene.add(fill)

    const groundMat=new THREE.MeshStandardMaterial({color:0x88ad73,roughness:.98})
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(34,25),groundMat)
    ground.rotation.x=-Math.PI/2
    ground.position.y=0
    ground.receiveShadow=true
    scene.add(ground)

    const island=new THREE.Mesh(new THREE.BoxGeometry(35,.65,26),new THREE.MeshStandardMaterial({color:0x6d8b66,roughness:.95}))
    island.position.y=-.39
    island.receiveShadow=true
    scene.add(island)

    const water=new THREE.Mesh(new THREE.PlaneGeometry(36,4.6),new THREE.MeshStandardMaterial({color:0x3d9eaa,roughness:.22,metalness:.08,transparent:true,opacity:.92}))
    water.rotation.x=-Math.PI/2
    water.position.set(0,.04,-11.1)
    scene.add(water)
    const bank=new THREE.Mesh(new THREE.BoxGeometry(34,.11,.6),new THREE.MeshStandardMaterial({color:0xd9dfb8,roughness:.92}))
    bank.position.set(0,.08,-8.85)
    scene.add(bank)

    road(scene,31,2.25,0,0)
    road(scene,2.25,20.6,0,0)
    road(scene,24,1.7,0,.1,Math.PI/4)
    road(scene,24,1.7,0,.1,-Math.PI/4)

    const bridge=new THREE.Mesh(new THREE.BoxGeometry(4.2,.25,4.8),new THREE.MeshStandardMaterial({color:0xbfc4bf,roughness:.88}))
    bridge.position.set(10.5,.3,-9.9)
    bridge.receiveShadow=true
    scene.add(bridge)
    for(const x of [8.7,12.3]){
      const rail=new THREE.Mesh(new THREE.BoxGeometry(.09,.7,4.6),new THREE.MeshStandardMaterial({color:0x646f69,roughness:.55,metalness:.45}))
      rail.position.set(x,.7,-9.9)
      scene.add(rail)
    }

    const buildingGroups=new Map<string,THREE.Group>()
    for(const def of DEPTS){
      const g=createBuilding(def)
      buildingGroups.set(def.id,g)
      scene.add(g)
    }

    const treeSpots:[number,number,number,boolean][]=[
      [-14,8,.9,false],[-12,10,.8,true],[-9.5,10.2,.74,false],[-6.8,10.4,.8,false],[-3,10.7,.72,true],[3.2,10.5,.72,false],[6.8,10.4,.8,true],[10.5,10,.8,false],[13.8,8.2,.9,true],
      [-14.6,4,.74,false],[-14.3,-1,.8,true],[-14,-5,.82,false],[14.3,4,.8,false],[14.2,0,.72,true],[14,-4.5,.86,false],
      [-12,-7.4,.8,true],[-9.7,-7.8,.78,false],[-7.8,-8.1,.7,false],[8,-8,.74,true],[10,-7.7,.8,false],[12.5,-7.2,.78,true],
      [-2.7,3.5,.62,false],[2.9,3.6,.62,false],[-3.1,-3,.6,true],[3.2,-2.9,.62,false]
    ]
    treeSpots.forEach(([x,z,s,p])=>scene.add(createTree(x,z,s,p)))

    ;[[-11,2.2],[-7.5,1.7],[-3.8,2.1],[4,2.1],[7.4,1.9],[11,2.4],[-4.5,-2.2],[4.7,-2.2]].forEach(([x,z])=>scene.add(createLamp(x,z)))

    const planterMat=new THREE.MeshStandardMaterial({color:0xb7b5a5,roughness:.92})
    const flowerMat=new THREE.MeshStandardMaterial({color:0xf19abb,roughness:.82})
    for(const [x,z] of [[-7.8,2.9],[7.8,2.9],[-2.9,-5.3],[3.5,-5.4]]){
      const p=new THREE.Group()
      p.position.set(x,0,z)
      const bed=new THREE.Mesh(new THREE.BoxGeometry(1.55,.18,.85),planterMat)
      bed.position.y=.1
      p.add(bed)
      for(let i=0;i<7;i++){
        const f=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),flowerMat)
        f.position.set(-.55+i*.18,.28,(i%2?-.17:.15))
        p.add(f)
      }
      scene.add(p)
    }

    const hub=new THREE.Group()
    const stone=new THREE.MeshStandardMaterial({color:0xc7cec7,roughness:.76,metalness:.12})
    const cyan=new THREE.MeshStandardMaterial({color:0x58dce5,emissive:0x2dc2cf,emissiveIntensity:1.55,roughness:.18,metalness:.35})
    const darkCyan=new THREE.MeshStandardMaterial({color:0x2e7f87,emissive:0x164f54,emissiveIntensity:.55,roughness:.3,metalness:.36})
    const base=new THREE.Mesh(new THREE.CylinderGeometry(2.15,2.35,.45,64),stone)
    base.position.y=.24
    base.castShadow=base.receiveShadow=true
    hub.add(base)
    const inner=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.55,.62,64),darkCyan)
    inner.position.y=.62
    inner.castShadow=true
    hub.add(inner)
    const ring1=new THREE.Mesh(new THREE.TorusGeometry(1.72,.07,12,64),cyan)
    ring1.rotation.x=Math.PI/2
    ring1.position.y=.78
    hub.add(ring1)
    const ring2=new THREE.Mesh(new THREE.TorusGeometry(2.0,.035,10,64),new THREE.MeshBasicMaterial({color:0x8ef5fa,transparent:true,opacity:.72,toneMapped:false}))
    ring2.rotation.x=Math.PI/2
    ring2.position.y=.76
    hub.add(ring2)
    const core=new THREE.Mesh(new THREE.CylinderGeometry(.72,.82,1.7,40),cyan)
    core.position.y=1.65
    core.castShadow=true
    hub.add(core)
    const coreLight=new THREE.PointLight(0x55eaf3,10,10,2)
    coreLight.position.y=2.0
    hub.add(coreLight)
    scene.add(hub)

    const networkNodes:{mesh:THREE.Mesh,curve:THREE.Curve<THREE.Vector3>,offset:number}[]=[]
    DEPTS.forEach((def,index)=>{
      const a=new THREE.Vector3(0,.16,0)
      const b=new THREE.Vector3(def.pos[0],.16,def.pos[1])
      const tube=lineTube(a,b)
      scene.add(tube)
      const dot=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),new THREE.MeshBasicMaterial({color:0xb9ffff,toneMapped:false}))
      scene.add(dot)
      networkNodes.push({mesh:dot,curve:tube.userData.curve,offset:index/DEPTS.length})
    })

    const clock=new THREE.Clock()
    let raf=0

    const resize=()=>{
      const rect=host.getBoundingClientRect()
      const width=Math.max(320,Math.floor(rect.width))
      const height=Math.max(260,Math.floor(rect.height))
      renderer.setSize(width,height,false)
      const aspect=width/height
      const viewH=24
      camera.left=-viewH*aspect/2
      camera.right=viewH*aspect/2
      camera.top=viewH/2
      camera.bottom=-viewH/2
      camera.updateProjectionMatrix()
    }
    resize()
    const observer=new ResizeObserver(resize)
    observer.observe(host)

    const animate=()=>{
      const t=clock.getElapsedTime()
      ring1.rotation.z=t*.18
      ring2.rotation.z=-t*.13
      core.position.y=1.65+Math.sin(t*1.5)*.08
      coreLight.intensity=8.5+Math.sin(t*2.1)*1.6
      networkNodes.forEach((n,i)=>{
        const p=n.curve.getPoint((t*.12+n.offset)%1)
        n.mesh.position.copy(p)
        const s=.8+Math.sin(t*3+i)*.18
        n.mesh.scale.setScalar(s)
      })
      buildingGroups.forEach((g,id)=>{
        const ring=g.userData.selectionRing as THREE.Mesh
        const mat=ring.material as THREE.MeshBasicMaterial
        const selected=id===selectedRef.current
        mat.opacity=selected ? .72 : 0
        ring.scale.setScalar(selected?1+Math.sin(t*2.2)*.045:1)
      })
      renderer.render(scene,camera)
      raf=requestAnimationFrame(animate)
    }
    animate()

    return ()=>{
      cancelAnimationFrame(raf)
      observer.disconnect()
      scene.traverse((obj:any)=>{
        if(obj.geometry) obj.geometry.dispose?.()
        const mats=Array.isArray(obj.material)?obj.material:[obj.material]
        mats.filter(Boolean).forEach((m:any)=>{m.map?.dispose?.();m.dispose?.()})
      })
      renderer.dispose()
      host.replaceChildren()
    }
  },[])

  return <div ref={hostRef} className="agent-three-map" aria-label="AI Agent 3D 工厂园区"/>
}
