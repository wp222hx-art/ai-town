import Game from './components/Game.tsx';

import { ToastContainer } from 'react-toastify';
import helpImg from '../assets/help.svg';
import { useState } from 'react';
import ReactModal from 'react-modal';
import MusicButton from './components/buttons/MusicButton.tsx';
import Button from './components/buttons/Button.tsx';
import InteractButton from './components/buttons/InteractButton.tsx';
import FreezeButton from './components/FreezeButton.tsx';
import { MAX_HUMAN_PLAYERS } from '../convex/constants.ts';
import PoweredBySynapse from './components/PoweredByConvex.tsx';
import { WORLD_LORE, WORLD_YEAR, FACTIONS, ZONES } from '../data/characters.ts';

export default function Home() {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [loreModalOpen, setLoreModalOpen] = useState(false);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between font-body game-background">
      <PoweredBySynapse />

      {/* ====== 帮助弹窗 ====== */}
      <ReactModal
        isOpen={helpModalOpen}
        onRequestClose={() => setHelpModalOpen(false)}
        style={modalStyles}
        contentLabel="帮助"
        ariaHideApp={false}
      >
        <div className="font-body">
          <h1 className="text-center text-6xl font-bold font-display game-title">帮助</h1>
          <p>
            欢迎来到 SYNAPSE 神经城。这里支持匿名<i>观察</i>和登录后的<i>互动</i>两种模式。
          </p>
          <h2 className="text-4xl mt-4">观察模式</h2>
          <p>
            点击并拖动可以在城市中移动视角，滚动鼠标滚轮可以缩放。点击某个角色可以查看其对话记录。
          </p>
          <h2 className="text-4xl mt-4">互动模式</h2>
          <p>
            登录后，你可以作为一个新的"意识体"加入 SYNAPSE 世界，直接与不同派系的 AI 角色对话！
            点击"加入"按钮后，你的角色会出现在地图上，脚下有高亮圆圈标识。
          </p>
          <p className="text-2xl mt-2">操作说明：</p>
          <p className="mt-4">点击地图任意位置可以移动。</p>
          <p className="mt-4">
            要与角色交谈，点击他们然后点击"发起对话"，他们会走向你。靠近后对话开始。
            你可以随时关闭对话框或走开来结束对话。AI 角色也可能主动邀请你——
            你会在消息面板看到接受按钮。
          </p>
          <p className="mt-4">
            SYNAPSE 同时最多支持 {MAX_HUMAN_PLAYERS} 个真人意识体。闲置五分钟将被传送回虚空之心。
          </p>
        </div>
      </ReactModal>

      {/* ====== 世界观弹窗 ====== */}
      <ReactModal
        isOpen={loreModalOpen}
        onRequestClose={() => setLoreModalOpen(false)}
        style={loreModalStyles}
        contentLabel="世界观"
        ariaHideApp={false}
      >
        <div className="font-body">
          <h1 className="text-center text-4xl font-bold font-display game-title mb-4">
            SYNAPSE 平行世界
          </h1>
          <p className="text-xs opacity-60 text-center mb-4">{WORLD_YEAR}</p>

          <p className="leading-relaxed text-sm mb-4 whitespace-pre-line">{WORLD_LORE}</p>

          <h2 className="text-2xl font-bold font-display game-title mt-4 mb-2">三大派系</h2>
          <div className="grid grid-cols-1 gap-2 mb-4">
            {Object.entries(FACTIONS).map(([name, f]) => (
              <div key={name} className="flex items-center gap-2 p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <span className="text-xl">{f.icon}</span>
                <div>
                  <span className="font-bold" style={{ color: f.color }}>{name}</span>
                  <span className="text-xs ml-2 opacity-70">"{f.motto}"</span>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold font-display game-title mt-4 mb-2">七大区域</h2>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {Object.entries(ZONES).map(([name, z]) => (
              <div key={name} className="flex items-center gap-1 p-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <span>{z.emoji}</span>
                <div>
                  <span className="font-bold">{name}</span>
                  <span className="ml-1 opacity-60">{z.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ReactModal>

      <div className="w-full lg:h-screen min-h-screen relative isolate overflow-hidden lg:p-8 shadow-2xl flex flex-col justify-start">
        <h1 className="mx-auto text-4xl p-3 sm:text-8xl lg:text-9xl font-bold font-display leading-none tracking-wide game-title neon-glow w-full text-left sm:text-center sm:w-auto">
          SYNAPSE 神经城
        </h1>

        <div className="max-w-xs md:max-w-xl lg:max-w-none mx-auto my-2 text-center text-base sm:text-xl md:text-2xl text-pink-200 leading-tight shadow-solid">
          {WORLD_YEAR} &mdash; 意识驱动的平行世界
        </div>

        {/* 派系标签条 */}
        <div className="flex justify-center gap-4 my-2 flex-wrap">
          {Object.entries(FACTIONS).filter(([name]) => name !== '中立').map(([name, f]) => (
            <span key={name} className="text-xs px-3 py-1 rounded-full border border-opacity-40 backdrop-blur-sm" style={{ borderColor: f.color, color: f.color, background: 'rgba(0,0,0,0.3)' }}>
              {f.icon} {name}
            </span>
          ))}
        </div>

        <Game />

        <footer className="justify-end bottom-0 left-0 w-full flex items-center mt-4 gap-3 p-6 flex-wrap pointer-events-none">
          <div className="flex gap-4 flex-grow pointer-events-none">
            <FreezeButton />
            <MusicButton />
            <InteractButton />
            <Button imgUrl={helpImg} onClick={() => setLoreModalOpen(true)}>
              世界观
            </Button>
            <Button imgUrl={helpImg} onClick={() => setHelpModalOpen(true)}>
              帮助
            </Button>
          </div>
        </footer>
        <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
      </div>
    </main>
  );
}

const modalStyles = {
  overlay: {
    backgroundColor: 'rgb(0, 0, 0, 80%)',
    zIndex: 12,
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: '50%',

    border: '1px solid rgba(255, 183, 197, 0.35)',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, rgb(45, 25, 35) 0%, rgb(55, 30, 45) 100%)',
    color: 'white',
    fontFamily: '"Upheaval Pro", "sans-serif"',
    boxShadow: '0 0 30px rgba(255, 150, 200, 0.1)',
  },
};

const loreModalStyles = {
  overlay: {
    backgroundColor: 'rgb(0, 0, 0, 80%)',
    zIndex: 12,
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'auto' as const,

    border: '2px solid rgba(255, 183, 197, 0.35)',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, rgb(45, 25, 35) 0%, rgb(55, 30, 45) 100%)',
    color: 'white',
    fontFamily: '"Upheaval Pro", "sans-serif"',
    boxShadow: '0 0 40px rgba(255, 150, 200, 0.1)',
  },
};
