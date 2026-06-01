export interface TabMeta {
  path: string
  label: string
  icon: string
  description: string
  long: string
}

export const TAB_META: TabMeta[] = [
  {
    path: '/agent',
    label: 'Agent',
    icon: '⬡',
    description: 'Chat with the agent to generate and iterate on Csound pieces.',
    long: 'Describe a sound, sketch, or instrument in plain language. The agent writes CSD, web apps, or Cabbage plugin drafts inline — play, edit, or convert them without leaving the conversation.',
  },
  {
    path: '/apps',
    label: 'Web Apps',
    icon: '◫',
    description: 'Browse six reference web apps — drum machine, FM bell, études, more.',
    long: 'A gallery of finished, playable reference apps. Open one to preview it live, read the code, or drop its core idea into the editor.',
  },
  {
    path: '/player',
    label: 'Player',
    icon: '▶',
    description: 'Drop a CSD to play it with live knobs and a piano keyboard.',
    long: 'Performance surface for CSD files. Rotary knobs bind to exposed parameters, a 3-octave keyboard triggers notes, and a waveform display shows what is coming out.',
  },
  {
    path: '/graph',
    label: 'Graph',
    icon: '◉',
    description: 'Explore a graph of people, works, and technologies in computer music.',
    long: 'Interactive knowledge graph of computer music history — 34 people, 15 organizations, 25 technologies, and more. Filter, search, or ask the graph a question directly.',
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: '⚙',
    description: 'API keys, theme, audio feedback, and Csound path.',
    long: 'Manage API keys for Google, Anthropic, and OpenAI, tune appearance and sound, and point DrC at your Csound binary.',
  },
]

export function tabMetaFor(path: string): TabMeta | undefined {
  return TAB_META.find((t) => t.path === path)
}
