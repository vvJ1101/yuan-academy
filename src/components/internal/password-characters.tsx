'use client'

/**
 * 三个卡通小人（临时用 emoji 调试）
 * 捂捂🙈 → 转转🙉 → 萌萌🙊
 */
function CharacterHands({ covering }: { covering: boolean }) {
  return (
    <span style={{ fontSize: 22, lineHeight: '40px', display: 'inline-block', transition: 'all 0.3s ease-out' }}>
      {covering ? '🙈' : '👀'}
    </span>
  )
}

function CharacterTurn({ covering }: { covering: boolean }) {
  return (
    <span style={{ fontSize: 22, lineHeight: '40px', display: 'inline-block', transition: 'all 0.3s ease-out' }}>
      {covering ? '🙉' : '👀'}
    </span>
  )
}

function CharacterBlindfold({ covering }: { covering: boolean }) {
  return (
    <span style={{ fontSize: 22, lineHeight: '40px', display: 'inline-block', transition: 'all 0.3s ease-out' }}>
      {covering ? '🙊' : '👀'}
    </span>
  )
}

export function PasswordCharacter({ variant, covering }: { variant: 0 | 1 | 2; covering: boolean }) {
  switch (variant) {
    case 0: return <CharacterHands covering={covering} />
    case 1: return <CharacterTurn covering={covering} />
    case 2: return <CharacterBlindfold covering={covering} />
  }
}
