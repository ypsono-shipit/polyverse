export interface EcosystemProject {
  id: string;
  name: string;
  logo: string;
  description: string;
  link: string;
  token: string;
  tokenLink: string;
  platform: 'Polymarket' | 'Kalshi' | 'Both';
}

export const defaultEcosystemProjects: EcosystemProject[] = [
  {
    id: "1",
    name: "Polymarket",
    logo: "https://polymarket.com/favicon.ico",
    description: "The world's largest prediction market.",
    link: "https://polymarket.com",
    token: "None",
    tokenLink: "",
    platform: "Polymarket"
  },
  {
    id: "2",
    name: "Kalshi",
    logo: "https://kalshi.com/favicon.ico",
    description: "The first regulated financial exchange dedicated to trading on future events.",
    link: "https://kalshi.com",
    token: "None",
    tokenLink: "",
    platform: "Kalshi"
  },
  {
    id: "3",
    name: "dFlow",
    logo: "https://dflow.net/favicon.ico",
    description: "Decentralized order flow market.",
    link: "https://dflow.net",
    token: "$DFLOW",
    tokenLink: "https://dflow.net",
    platform: "Both"
  }
];

export const getEcosystemProjects = (): EcosystemProject[] => {
  const stored = localStorage.getItem('polyverse_ecosystem');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse stored ecosystem projects", e);
    }
  }
  return defaultEcosystemProjects;
};

export const saveEcosystemProjects = (projects: EcosystemProject[]) => {
  localStorage.setItem('polyverse_ecosystem', JSON.stringify(projects));
};
