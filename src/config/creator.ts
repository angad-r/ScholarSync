/**
 * Platform Creator & Maintainer Configuration
 *
 * This configuration defines the immutable identity and official links for the creator
 * of ScholarSync. These values are fixed platform metadata and cannot be overwritten
 * or modified by ordinary user actions, database resets, or personal data imports.
 */

export interface CreatorProfile {
  readonly name: string;
  readonly githubUrl: string;
  readonly linkedinUrl: string;
}

export const PLATFORM_CREATOR: Readonly<CreatorProfile> = Object.freeze({
  name: 'Angad Ranjan',
  githubUrl: 'https://github.com/angad-r',
  linkedinUrl: 'https://in.linkedin.com/in/angad-ranjan-057616380',
});
