export type Registration = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  techSkill: string;
  email: string;
  createdAt: string;
};

export type LearningTrack = {
  id: string;
  name: string;
  whatsappLink: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunityManager = {
  id: string;
  email: string;
  trackName: string;
  createdAt: string;
};

export type AuthStatus = { text: string; kind: "info" | "success" | "error" };