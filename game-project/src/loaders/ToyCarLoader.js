import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { createBoxShapeFromModel, createTrimeshShapeFromModel } from '../Experience/Utils/PhysicsShapeFactory.js'
import Prize from '../Experience/World/Prize.js'

export default class ToyCarLoader {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.physics = this.experience.physics
        this.prizes = []
    }

    async loadFromAPI() {
        try {
            const listRes = await fetch('/config/precisePhysicsModels.json')
            const precisePhysicsModels = await listRes.json()

            let blocks = []

            try {
                const apiUrl = import.meta.env.VITE_API_URL + '/api/blocks'
                const res = await fetch(apiUrl)

                if (!res.ok) throw new Error('Conexión fallida')

                blocks = await res.json()
                console.log('✅ Datos cargados desde la API:', blocks.length)
            } catch (apiError) {
                console.warn('⚠️ No se pudo conectar con la API. Cargando desde archivo local...')
                const localRes = await fetch('/data/threejs_blocks.blocks.json')
                blocks = await localRes.json()
                console.log('📦 Datos cargados desde archivo local:', blocks.length)
            }

            blocks.forEach(block => {
                if (!block.name) {
                    console.warn('🛑 Bloque sin nombre:', block)
                    return
                }

                const resourceKey = block.name
                const glb = this.resources.items[resourceKey]

                if (!glb) {
                    console.warn(`🛑 Modelo no encontrado: ${resourceKey}`)
                    return
                }

                const model = glb.scene.clone()

                // 🎯 Manejo de Carteles
                const cube = this.scene.getObjectByName('Cube')
                if (cube) {
                    //console.log('✅ Cartel encontrado:', cube.name)

                    // 1) Carga la textura
                    const textureLoader = new THREE.TextureLoader()
                    const texture = textureLoader.load('/textures/ima1.jpg', () => {
                        // 1) Ajustes de color y filtrado
                        texture.encoding = THREE.sRGBEncoding
                        texture.wrapS = THREE.ClampToEdgeWrapping
                        texture.wrapT = THREE.ClampToEdgeWrapping
                        texture.anisotropy = this.experience.renderer.instance.capabilities.getMaxAnisotropy()

                        // 2) Centrar el pivote de rotación y girar 90°
                        texture.center.set(0.5, 0.5)        // mueve el pivote al centro de la imagen
                        texture.rotation = -Math.PI / 2     // gira -90°, cámbialo a +Math.PI/2 si lo necesitas

                        // 3) Crea un material y aplícalo
                        cube.material = new THREE.MeshBasicMaterial({
                            map: texture,
                            side: THREE.DoubleSide
                        })
                        cube.material.needsUpdate = true
                        
                    })

                }

                // 🎯 Si es un premio (coin, reward, etc.)
                if (block.name.startsWith('coin')) {
                    console.log(`Premio detectado: ${block.name}`)
                    const prize = new Prize({
                        model,
                        position: new THREE.Vector3(block.x, block.y, block.z),
                        scene: this.scene
                    })
                    this.prizes.push(prize)
                    this.scene.add(prize.model)
                    return
                }

                this.scene.add(model)

                let shape
                let position = new THREE.Vector3()

                if (precisePhysicsModels.includes(block.name)) {
                    shape = createTrimeshShapeFromModel(model)
                    if (!shape) {
                        console.warn(`❌ No se pudo crear Trimesh para ${block.name}`)
                        return
                    }

                    // Los modelos Trimesh ya están posicionados correctamente
                    position.set(0, 0, 0)
                } else {
                    shape = createBoxShapeFromModel(model, 0.9) // puedes ajustar 0.9 → 0.85 si lo deseas

                    const bbox = new THREE.Box3().setFromObject(model)
                    const center = new THREE.Vector3()
                    const size = new THREE.Vector3()
                    bbox.getCenter(center)
                    bbox.getSize(size)

                    center.y -= size.y / 2 // apoyar la caja sobre el piso
                    position.copy(center)
                }

                const body = new CANNON.Body({
                    mass: 0,
                    shape: shape,
                    position: new CANNON.Vec3(position.x, position.y, position.z),
                    material: this.physics.obstacleMaterial
                })

                this.physics.world.addBody(body)
            })

        } catch (err) {
            console.error('❌ Error al cargar bloques o lista Trimesh:', err)
        }
    }
}