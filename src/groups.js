// Gruppi utenti corrispondenti al file Excel originale
export const USER_GROUPS = [
  {
    id: 'orange',
    label: 'Cristiano / Umberto',
    color: '#ea580c',
    bg: 'rgba(234, 88, 12, 0.18)',
    border: '#ea580c',
    badgeText: '#fff'
  },
  {
    id: 'slate',
    label: 'Framarcar / Marino',
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.25)',
    border: '#64748b',
    badgeText: '#fff'
  },
  {
    id: 'blue',
    label: 'Mimmoumberto',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.20)',
    border: '#3b82f6',
    badgeText: '#fff'
  },
  {
    id: 'silver',
    label: 'Salsc / Abate',
    color: '#9ca3af',
    bg: 'rgba(156, 163, 175, 0.22)',
    border: '#9ca3af',
    badgeText: '#fff'
  },
  {
    id: 'peach',
    label: 'Fruttivendolo',
    color: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.22)',
    border: '#fb923c',
    badgeText: '#1f2937'
  },
  {
    id: 'green',
    label: 'Piazza / Amici',
    color: '#84cc16',
    bg: 'rgba(132, 204, 22, 0.22)',
    border: '#84cc16',
    badgeText: '#1f2937'
  },
  {
    id: 'rust',
    label: 'Scarpati',
    color: '#c2410c',
    bg: 'rgba(194, 65, 12, 0.26)',
    border: '#c2410c',
    badgeText: '#fff'
  },
  {
    id: 'yellow',
    label: 'Galba / Alba',
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.25)',
    border: '#eab308',
    badgeText: '#1f2937'
  }
];

// Mappatura automatica username -> ID gruppo iniziale (identica al file Excel)
export const DEFAULT_USER_GROUPS = {
  // Arancione
  'umbgcrist': 'orange',
  'Umbsuocgcrist': 'orange',
  'giacri': 'orange',

  // Slate / Blu-Grigio
  'framarcar': 'slate',
  'framarcnip': 'slate',
  'diabolik81': 'slate',
  'donatoc': 'slate',

  // Azzurro
  'Mimmoumberto': 'blue',
  'giufon': 'blue',

  // Grigio Argento
  'salsc': 'silver',
  'rafaba': 'silver',

  // Pesca
  'enzofruvic': 'peach',
  'mauriziofrut': 'peach',
  'maurizio2': 'peach',
  'enzfrutt': 'peach',

  // Verde
  'gianldes': 'green',
  'pignafrat': 'green',
  'maremoto1': 'green',
  'menzio': 'green',
  'men2': 'green',
  'palzio': 'green',
  'palzio2': 'green',

  // Ruggine
  'redsca': 'rust',
  'redsca2': 'rust',
  'redbros': 'rust',
  'redbros2': 'rust',

  // Giallo
  'galba': 'yellow',
  'egida': 'yellow',
  'bobparen': 'yellow',
  'mattalba': 'yellow',
  'galba2': 'yellow',
  'pesan': 'yellow',
  'pasquatap': 'yellow'
};

export function getUserGroup(username, itemGroup) {
  const groupId = itemGroup || (username ? DEFAULT_USER_GROUPS[username] : null);
  if (!groupId) return null;
  return USER_GROUPS.find(g => g.id === groupId) || null;
}
