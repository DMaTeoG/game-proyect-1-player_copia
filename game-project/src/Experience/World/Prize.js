import * as THREE from 'three'
import { narrar } from '../Experience/Utils/ScreenReader.js'
import Sound from './Sound.js'

export default class Prize {
    constructor({ model, position, scene }) {
        this.scene = scene
        this.collected = false

        // 📌 Crear el pivot
        this.pivot = new THREE.Group()
        this.pivot.position.copy(position)

        this.model = model.clone()

        const visual = this.model.children[0] || this.model
        visual.position.set(0, 0, 0)
        visual.rotation.set(0, 0, 0)
        visual.scale.set(1, 1, 1)

        this.pivot.add(visual)

        const helper = new THREE.AxesHelper(0.5)
        this.pivot.add(helper)

        this.scene.add(this.pivot)

        this.collectSound = new Sound('/sounds/premio.mp3')

        console.log(`🎯 Premio en: (${position.x}, ${position.y}, ${position.z})`)
    }

    update(delta) {
        if (this.collected) return
        this.pivot.rotation.y += delta * 1.5
    }

    collect() {
        this.collected = true
        this.scene.remove(this.pivot)

        this.collectSound.play()
        narrar("Premio recogido.")
    }
}
