import { PaginatedResult, Logger } from '@experience-gift/shared-types';
import { RedisCache } from '../cache/redis-cache';
import {
  ExperienceRepository,
  Experience,
  CategoryRepository,
  Category,
  OccasionRepository,
  Occasion,
  TemplateRepository,
  GiftCardTemplate,
  CollectionRepository,
  CuratedCollection,
  TimeSlotRepository,
  TimeSlot,
  AgeGroupMappingRepository,
} from '../repositories';

export interface ExperienceFilters {
  category?: string;
  ageGroup?: string;
  occasion?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface ExperienceSummary {
  id: string;
  name: string;
  description: string;
  partnerName: string;
  priceCents: number;
  currency: string;
  imageUrl: string;
  ageGroups: string[];
  occasions: string[];
  categoryId: string;
  location: string;
}

export interface ExperienceDetail extends ExperienceSummary {
  imageUrls: string[];
  partnerInstructions?: string;
  availableTimeSlots: TimeSlot[];
  partnerId: string;
}

export interface CatalogServiceDeps {
  experienceRepo: ExperienceRepository;
  categoryRepo: CategoryRepository;
  occasionRepo: OccasionRepository;
  templateRepo: TemplateRepository;
  collectionRepo: CollectionRepository;
  timeSlotRepo: TimeSlotRepository;
  ageGroupMappingRepo: AgeGroupMappingRepository;
  cache: RedisCache;
  logger: Logger;
}

export class CatalogService {
  private readonly experienceRepo: ExperienceRepository;
  private readonly categoryRepo: CategoryRepository;
  private readonly occasionRepo: OccasionRepository;
  private readonly templateRepo: TemplateRepository;
  private readonly collectionRepo: CollectionRepository;
  private readonly timeSlotRepo: TimeSlotRepository;
  private readonly ageGroupMappingRepo: AgeGroupMappingRepository;
  private readonly cache: RedisCache;
  private readonly logger: Logger;

  constructor(deps: CatalogServiceDeps) {
    this.experienceRepo = deps.experienceRepo;
    this.categoryRepo = deps.categoryRepo;
    this.occasionRepo = deps.occasionRepo;
    this.templateRepo = deps.templateRepo;
    this.collectionRepo = deps.collectionRepo;
    this.timeSlotRepo = deps.timeSlotRepo;
    this.ageGroupMappingRepo = deps.ageGroupMappingRepo;
    this.cache = deps.cache;
    this.logger = deps.logger;
  }

  async listExperiences(filters: ExperienceFilters): Promise<PaginatedResult<ExperienceSummary>> {
    const { category, ageGroup, occasion, search, page, limit } = filters;
    const cacheKey = `experiences:list:${JSON.stringify(filters)}`;

    const cached = await this.cache.get<PaginatedResult<ExperienceSummary>>(cacheKey);
    if (cached) return cached;

    let experiences: Experience[];

    if (search) {
      const result = await this.experienceRepo.searchByText(search);
      experiences = result.items;
    } else {
      const result = await this.experienceRepo.listActive();
      experiences = result.items;
    }

    // Apply compound filters as intersection
    if (category) {
      experiences = experiences.filter((e) => e.categoryId === category);
    }

    if (ageGroup) {
      const mappings = await this.ageGroupMappingRepo.getExperienceIdsForAgeGroup(ageGroup);
      const ageGroupExpIds = new Set(mappings.map((m) => m.experienceId));
      experiences = experiences.filter((e) => ageGroupExpIds.has(e.id));
    }

    if (occasion) {
      const mappings = await this.occasionRepo.getExperienceIdsForOccasion(occasion);
      const occasionExpIds = new Set(mappings.items.map((m) => m.experienceId));
      experiences = experiences.filter((e) => occasionExpIds.has(e.id));
    }

    const total = experiences.length;
    const startIndex = (page - 1) * limit;
    const paged = experiences.slice(startIndex, startIndex + limit);

    const result: PaginatedResult<ExperienceSummary> = {
      items: paged.map(toExperienceSummary),
      total,
      page,
      limit,
      hasMore: startIndex + limit < total,
    };

    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getExperience(id: string): Promise<ExperienceDetail | null> {
    const cacheKey = `experience:${id}`;
    const cached = await this.cache.get<ExperienceDetail>(cacheKey);
    if (cached) return cached;

    const experience = await this.experienceRepo.getById(id);
    if (!experience || experience.status !== 'active') return null;

    const availableSlots = await this.timeSlotRepo.listAvailableByExperience(id);

    const detail: ExperienceDetail = {
      ...toExperienceSummary(experience),
      imageUrls: experience.imageUrls,
      partnerInstructions: experience.partnerInstructions,
      availableTimeSlots: availableSlots,
      partnerId: experience.partnerId,
    };

    await this.cache.set(cacheKey, detail, 120);
    return detail;
  }

  async getCategories(): Promise<Category[]> {
    const cacheKey = 'categories:all';
    const cached = await this.cache.get<Category[]>(cacheKey);
    if (cached) return cached;

    const categories = await this.categoryRepo.listAll();
    await this.cache.set(cacheKey, categories, 300);
    return categories;
  }

  async getOccasions(): Promise<Occasion[]> {
    const cacheKey = 'occasions:all';
    const cached = await this.cache.get<Occasion[]>(cacheKey);
    if (cached) return cached;

    const occasions = await this.occasionRepo.listActive();
    await this.cache.set(cacheKey, occasions, 300);
    return occasions;
  }

  async getOccasionCollection(occasionId: string, currentDate?: string): Promise<CuratedCollection | null> {
    const date = currentDate ?? new Date().toISOString().split('T')[0];
    const cacheKey = `collections:occasion:${occasionId}:${date}`;

    const cached = await this.cache.get<CuratedCollection>(cacheKey);
    if (cached) return cached;

    const collection = await this.collectionRepo.getActiveForOccasionAndDate(occasionId, date);
    if (collection) {
      await this.cache.set(cacheKey, collection, 300);
    }
    return collection;
  }

  async getOccasionTemplates(occasionId: string): Promise<GiftCardTemplate[]> {
    const cacheKey = `templates:occasion:${occasionId}`;
    const cached = await this.cache.get<GiftCardTemplate[]>(cacheKey);
    if (cached) return cached;

    const templates = await this.templateRepo.listActiveByOccasion(occasionId);
    await this.cache.set(cacheKey, templates, 300);
    return templates;
  }
}

function toExperienceSummary(exp: Experience): ExperienceSummary {
  return {
    id: exp.id,
    name: exp.name,
    description: exp.description,
    partnerName: exp.partnerName,
    priceCents: exp.priceCents,
    currency: exp.currency,
    imageUrl: exp.imageUrls[0] ?? '',
    ageGroups: exp.ageGroups,
    occasions: exp.occasions,
    categoryId: exp.categoryId,
    location: exp.location,
  };
}
