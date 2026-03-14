// src/components/LabsSimulation.tsx
import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { setGameInstance } from "../utils/gameInstance";

type ResearcherInfo = {
  id: string;
  name: string;
  specialization: string[];
  spriteKey: string;
  x: number;
  y: number;
  lab: "mercatorum" | "blekinge" | "opbg";
};

// ––– dati di esempio: sostituisci spriteKey e coordinate reali –––
const RESEARCHERS: ResearcherInfo[] = [
  {
    id: "r1",
    name: "Alice – PhD Student",
    specialization: ["Data science", "Privacy engineering"],
    spriteKey: "phd",
    x: 120,
    y: 180,
    lab: "mercatorum",
  },
  {
    id: "r2",
    name: "Björn – ML Engineer",
    specialization: ["Model optimisation", "Edge FL"],
    spriteKey: "mleng",
    x: 420,
    y: 140,
    lab: "blekinge",
  },
  {
    id: "r3",
    name: "Chiara – Medical Doctor",
    specialization: ["Clinical data", "Diagnostic models"],
    spriteKey: "doctor",
    x: 720,
    y: 200,
    lab: "opbg",
  },
];

interface PopupProps {
  researcher: ResearcherInfo;
  onClose: () => void;
}

const Popup: React.FC<PopupProps> = ({ researcher, onClose }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-xl p-6 w-64">
      <h2 className="text-xl font-semibold mb-2">{researcher.name}</h2>
      <ul className="list-disc pl-4 text-sm space-y-1">
        {researcher.specialization.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <button
        onClick={onClose}
        className="mt-4 w-full rounded-lg bg-blue-600 text-white py-1.5"
      >
        Chiudi
      </button>
    </div>
  </div>
);

const LabsSimulation: React.FC = () => {
  const phaserParent = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<ResearcherInfo | null>(null);

  useEffect(() => {
    if (!phaserParent.current) return;

    /* ---------- Phaser scene ---------- */
    class LabScene extends Phaser.Scene {
      constructor() {
        super("LabScene");
      }

      preload() {
        // Placeholder asset loader – usa i tuoi sprite reali!
        this.load.image("mercatorum-bg", "/assets/labs/mercatorum.png");
        this.load.image("blekinge-bg", "/assets/labs/blekinge.png");
        this.load.image("opbg-bg", "/assets/labs/opbg.png");

        this.load.spritesheet("phd", "/assets/sprites/phd.png", {
          frameWidth: 32,
          frameHeight: 32,
        });
        this.load.spritesheet("mleng", "/assets/sprites/mleng.png", {
          frameWidth: 32,
          frameHeight: 32,
        });
        this.load.spritesheet("doctor", "/assets/sprites/doctor.png", {
          frameWidth: 32,
          frameHeight: 32,
        });
      }

      create() {
        /* —–– disegna i tre laboratori uno accanto all'altro —–– */
        const labWidth = 320;
        this.add.image(labWidth * 0.5, 180, "mercatorum-bg");
        this.add.image(labWidth * 1.5, 180, "blekinge-bg");
        this.add.image(labWidth * 2.5, 180, "opbg-bg");

        /* —–– inserisce i ricercatori e rende lo sprite interattivo —–– */
        RESEARCHERS.forEach((r) => {
          const sprite = this.add
            .sprite(r.x, r.y, r.spriteKey, 0)
            .setInteractive({ useHandCursor: true })
            .setScale(1.5);

          sprite.on("pointerdown", () => {
            // comunica a React il ricercatore selezionato
            this.game.events.emit("researcher-clicked", r);
          });

          // animazione idle facoltativa
          this.anims.create({
            key: `${r.spriteKey}-idle`,
            frames: this.anims.generateFrameNumbers(r.spriteKey, {
              start: 0,
              end: 3,
            }),
            frameRate: 6,
            repeat: -1,
          });
          sprite.play(`${r.spriteKey}-idle`);
        });
      }
    }

    /* ---------- Config e creazione gioco ---------- */
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 960, // 3 laboratori da 320 px
      height: 360,
      parent: phaserParent.current,
      backgroundColor: "#1e1e1e",
      scale: { mode: Phaser.Scale.FIT },
      scene: LabScene,
    });

    // Registra l'istanza del gioco per uso globale
    setGameInstance(game);

    // Listener evento → stato React
    game.events.on("researcher-clicked", setSelected);

    return () => game.destroy(true); // cleanup quando il componente si smonta
  }, []);

  return (
    <>
      <div ref={phaserParent} className="w-full h-full" />
      {selected && <Popup researcher={selected} onClose={() => setSelected(null)} />}
    </>
  );
};

export default LabsSimulation;