// Post Types
export type PostTag =
  | "ޙިދުމަތް"
  | "އާންމުމަޢުލޫމާތު"
  | "އެންގުން"
  | "އެހެނިހެން"
  | "ދަރަނި"
  | "ތައުޒިޔާ"
  | "ޚުތުބާ";

export interface Post {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  title: string;
  content: string;
  tag: PostTag;
  date: string;
  author: string;
  authorId: string;
  imageUrl?: string;
  published: boolean;
  priority: number;
  views: number;
  likes: number;
}

export interface CreatePostInput {
  title: string;
  content: string;
  tag: PostTag;
  author: string;
  authorId: string;
  featuredImage?: File;
  published?: boolean;
  priority?: number;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  tag?: PostTag;
  featuredImage?: File;
  published?: boolean;
  priority?: number;
}

// Publication Types
export type PublicationCategory =
  | "ޙިދުމަތް"
  | "އާންމުމަޢުލޫމާތު"
  | "އެންގުން"
  | "އެހެނިހެން"
  | "ދަރަނި"
  | "ތައުޒިޔާ"
  | "ޚުތުބާ";

export interface Publication {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  title: string;
  titleDhivehi?: string;
  subtitle: string;
  date: string;
  category: PublicationCategory;
  fileUrl?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  author: string;
  authorId: string;
  published: boolean;
  downloads: number;
  views: number;
}

export interface CreatePublicationInput {
  title: string;
  titleDhivehi?: string;
  subtitle: string;
  category: PublicationCategory;
  author: string;
  authorId: string;
  file?: File;
  published?: boolean;
}

export interface UpdatePublicationInput {
  title?: string;
  titleDhivehi?: string;
  subtitle?: string;
  category?: PublicationCategory;
  file?: File;
  published?: boolean;
}

// Filter and Query Types
export interface PostFilters {
  tag?: PostTag;
  published?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export type PubFilter =
  | "ހުރިހާ"
  | "ކައުންސިލްނިންމުން"
  | "އ.ތ.މ.ކޮމެޓީގެނިންމުން"
  | "އިޢުލާން"
  | "އެހެނިހެން"
  | "އާންމުމަޢުލޫމާތު";

export interface PublicationFilters {
  category?: PublicationCategory;
  published?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// Response Types
export interface PaginatedResponse<T> {
  documents: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// COUNCILGE NINMUN
export type Ninmun = {
  $id: string;
  publicationNumber: string;
  title: string;
  subtitle: string;
  issue: string;
  issuetakenby: string;
  issuepresentedby: string;
  finalnote: string;
  $createdAt: string;
  $updatedAt: string;
};

export type NinmunVoteValue = "FOR" | "AGAINST" | "ABSTAIN" | "ABSENT";

export type NinmunVote = {
  $id: string;
  ninmunId: string;
  councillorId: string;
  vote: NinmunVoteValue;
  note?: string | null;
  $createdAt: string;
  $updatedAt: string;
};
