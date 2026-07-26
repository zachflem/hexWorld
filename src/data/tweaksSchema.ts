import { z } from "zod";

const resourceCostMap = z.record(z.string(), z.number());
const numberRecord = z.record(z.string(), z.number());
const stringArrayRecord = z.record(z.string(), z.array(z.string()));

const extractionResourceSchema = z.object({
  small_yield_per_tick: z.number(),
  build_cost_base: resourceCostMap,
  _build_cost_note: z.string().optional(),
  build_cost_scaling: z.string(),
  tier_upgrade_cost_base: resourceCostMap,
  tier_upgrade_cost_scaling: z.string(),
  noise_passive_per_min: z.number(),
  noise_build: z.number(),
  noise_upgrade: z.number(),
});

/** One multiplier per TerrainType (engine/terrain.ts) — used by extraction_tiles.terrain_yield_multiplier below. */
const terrainYieldMultiplierSchema = z.object({
  water: z.number(),
  shore: z.number(),
  grassland: z.number(),
  forest: z.number(),
  mountain: z.number(),
});

export const tweaksSchema = z.object({
  meta: z.object({
    version: z.string(),
    slug: z.string(),
    profile_name: z.string(),
    notes: z.string(),
  }),

  game: z.object({
    grid_size: z.number(),
    /** When true, onboarding map-size choice is ignored — profile fixes size for a authored scenario. */
    grid_size_locked: z.boolean().optional(),
    /** When set, onboarding seed is ignored — profile fixes the world seed for a authored scenario. */
    world_seed: z.number().int().nonnegative().optional(),
    tick_interval_seconds: z.number(),
    resource_accumulation_precision_seconds: z.number(),
  }),

  resources: z.object({
    types: z.array(z.string()),
    rarity_order: z.array(z.string()),
    starting_amounts: z
      .object({
        food: z.number(),
        wood: z.number(),
        stone: z.number(),
        steel: z.number(),
      })
      .catchall(z.string()),
  }),

  extraction_tiles: z.object({
    yield_scaling: z.object({
      _formula: z.string(),
      tier_multiplier: z.number(),
    }),
    tier_upgrade_time_minutes_base: z.number(),
    _tier_upgrade_time_note: z.string(),
    build_time_minutes: z.number(),
    _build_time_note: z.string(),
    food: extractionResourceSchema,
    wood: extractionResourceSchema,
    stone: extractionResourceSchema,
    steel: extractionResourceSchema,
    terrain_yield_multiplier: z.object({
      food: terrainYieldMultiplierSchema,
      wood: terrainYieldMultiplierSchema,
      stone: terrainYieldMultiplierSchema,
      steel: terrainYieldMultiplierSchema,
      _status: z.string(),
    }),
    tech_progression: z.object({
      small_to_mid: z.array(z.string()),
      mid_to_large: z.array(z.string()),
      _note: z.string(),
    }),
  }),

  /** Power stations — capacity + AoE network (Milestone 25 / #70). First pass, untested. */
  power: z.object({
    max_level: z.number(),
    capacity_base: z.number(),
    capacity_per_level: z.number(),
    aoe_base_tiles: z.number(),
    aoe_per_level: z.number(),
    cutoff_factor: z.number(),
    build_cost_base: resourceCostMap,
    upgrade_cost_base: resourceCostMap,
    build_time_minutes: z.number(),
    upgrade_time_minutes_base: z.number(),
    draw_base: z.object({
      extraction: z.number(),
      tower: z.number(),
      wall: z.number(),
      barracks: z.number(),
      dock: z.number(),
      scrap_yard: z.number(),
    }),
    noise_build: z.number(),
    noise_upgrade: z.number(),
    passive_noise_floor_per_level: z.number(),
  }),

  transition_tiles: z.object({
    yield_multiplier: z.number(),
    scout_flavor_text: z.string(),
  }),

  docks: z.object({
    build_cost_base: resourceCostMap,
    build_cost_scaling: z.string(),
    build_time_minutes: z.number(),
    yield_multiplier_vs_food_tile: z.number(),
    /** M26: L1 manual → L2 courier → L3 production. Keys are target levels. */
    level_upgrades: z.object({
      "2": z.object({
        cost: resourceCostMap,
        build_time_minutes: z.number(),
      }),
      "3": z.object({
        cost: resourceCostMap,
        build_time_minutes: z.number(),
      }),
    }),
    /** L3 yield multiplier (legacy fishing-boat bonus). */
    fishing_boat: z.object({
      cost: resourceCostMap,
      yield_bonus_multiplier: z.number(),
      build_time_minutes: z.number(),
    }),
    scout_skiff: z.object({
      cost: resourceCostMap,
      max_per_dock: z.number(),
      seconds_per_step: z.number(),
      build_time_minutes: z.number(),
    }),
  }),

  towers: z.object({
    build_cost_base: resourceCostMap,
    build_cost_scaling: z.string(),
    build_time_minutes: z.number(),
    _build_time_note: z.string(),
    base_range_tiles: z.number(),
    range_per_level: z.number(),
    /** Flat tile offset added to tower range from the tower's own tile terrain (#79). */
    range_terrain_offset: terrainYieldMultiplierSchema,
    _range_terrain_offset_note: z.string(),
    base_damage: z.number(),
    damage_scaling: z.string(),
    damage_formula_vs_horde: z.string(),
    upgrade_cost_base: resourceCostMap,
    upgrade_cost_scaling: z.string(),
    upgrade_tech_progression: stringArrayRecord,
    upgrade_time_minutes_base: z.number(),
    _upgrade_time_note: z.string(),
    garrison_damage_bonus_per_militia: z.number(),
    _garrison_damage_bonus_note: z.string(),
  }),

  walls: z.object({
    tiers: z.array(z.string()),
    build_cost_base: resourceCostMap,
    build_cost_scaling: z.string(),
    build_time_minutes: z.number(),
    _build_time_note: z.string(),
    durability_hits_to_break: numberRecord,
    damage_taken_base_per_tier: numberRecord,
    _damage_taken_note: z.string().optional(),
    damage_taken_formula: z.string(),
    noise_dampening_per_tier: numberRecord,
    _noise_dampening_note: z.string(),
    garrison_range_bonus_tiles: z.number(),
    _garrison_range_bonus_note: z.string(),
    slot_cost: z.number(),
    _slot_cost_note: z.string(),
    tier_upgrade_cost_base: resourceCostMap,
    tier_upgrade_cost_scaling: z.string(),
    tier_upgrade_tech_progression: stringArrayRecord,
    tier_upgrade_time_minutes_base: z.number(),
    _tier_upgrade_time_note: z.string(),
    repair: z.object({
      allowed_during_combat: z.boolean(),
      cost_formula: z.string(),
      noise_per_repair: z.number(),
      seconds_per_missing_hp: z.number(),
      _time_note: z.string(),
    }),
  }),

  barracks: z.object({
    _status: z.string(),
    build_cost_base: resourceCostMap,
    build_cost_scaling: z.string(),
    build_time_minutes: z.number(),
    _build_time_note: z.string(),
    upgrade_cost_base: resourceCostMap,
    upgrade_cost_scaling: z.string(),
    upgrade_tech_progression: stringArrayRecord,
    upgrade_time_minutes_base: z.number(),
    _upgrade_time_note: z.string(),
    militia_capacity_per_level: z.number(),
    junkyard_knight_capacity_per_level: z.number(),
    cross_bow_sniper_capacity_per_level: z.number(),
    _capacity_note: z.string(),
  }),

  units: z.object({
    _status: z.string(),
    militia: z.object({
      train_cost: resourceCostMap,
      train_time_seconds: z.number(),
      upkeep_food_per_min: z.number(),
      attack_per_unit: z.number(),
      defense_per_unit: z.number(),
      _note: z.string(),
    }),
    junkyard_knight: z.object({
      train_cost: resourceCostMap,
      train_time_seconds: z.number(),
      upkeep_food_per_min: z.number(),
      attack_per_unit: z.number(),
      defense_per_unit: z.number(),
      min_barracks_level: z.number(),
      _note: z.string(),
    }),
    cross_bow_sniper: z.object({
      train_cost: resourceCostMap,
      train_time_seconds: z.number(),
      upkeep_food_per_min: z.number(),
      attack_per_unit: z.number(),
      defense_per_unit: z.number(),
      range_tiles: z.number(),
      ranged_damage_per_unit: z.number(),
      min_barracks_level: z.number(),
      _note: z.string(),
    }),
    wandering_scout: z.object({
      cost: resourceCostMap,
      max_per_barracks: z.number(),
      seconds_per_step: z.number(),
      build_time_minutes: z.number(),
    }),
    _desertion_note: z.string(),
  }),

  demolish: z.object({
    refund_pct: z.number(),
    _note: z.string(),
  }),

  storage: z.object({
    capacity_base_per_resource: z.number(),
    capacity_scaling: z.string(),
    _tile_stockpile_note: z.string(),
    /** Manual-collect (L1) map pin appears at this local fill ratio. */
    collect_pin_show_ratio: z.number(),
    /**
     * Courier-automated (L2+) map pin appears at this local fill ratio
     * (default 1 = only when the local buffer is full — usually hub storage).
     */
    collect_pin_courier_show_ratio: z.number(),
    _collect_pin_note: z.string().optional(),
    upgrade_cost_scaling: z.string(),
    upgrade_cost_base: z.record(z.string(), resourceCostMap),
    upgrade_time_minutes_base: z.number(),
    upgrade_time_growth_per_level_pct: z.number(),
  }),

  base_upgrades: z.object({
    cost_base: resourceCostMap,
    cost_scaling: z.string(),
    first_upgrade_time_minutes: z.number(),
    time_growth_per_level_pct: z.number(),
    time_scaling: z.string(),
    timer_runs_while_offline: z.boolean(),
    attack_radius_cap_base: z.number(),
    attack_radius_cap_per_level: z.number(),
    attack_radius_cap_formula: z.string(),
    build_slot_cap_base: z.number(),
    build_slot_cap_per_level: z.number(),
    build_slot_cap_formula: z.string(),
  }),

  base_reinforcement: z.object({
    base_hp: z.number(),
    hp_gain_per_level: z.number(),
    max_reinforcement_level_equals_base_level: z.boolean(),
    cost_base: resourceCostMap,
    cost_scaling: z.string(),
    upgrade_time_minutes_base: z.number(),
    seconds_per_missing_hp: z.number(),
  }),

  base_relocation: z.object({
    _status: z.string(),
    min_base_level: z.number(),
    cost_per_tile_distance: resourceCostMap,
    seconds_per_tile_distance: z.number(),
    _note: z.string(),
  }),

  territory_expansion: z.object({
    _status: z.string(),
    tile_defense_base: z.number(),
    tile_defense_per_distance: z.number(),
    tile_defense_formula: z.string(),
  }),

  expeditions: z.object({
    _status: z.string(),
    provisions_food_per_unit_per_cost: z.number(),
    travel_seconds_per_cost: z.number(),
    tombstone_lifetime_minutes: z.number(),
    /** Extra Dijkstra weight for stepping onto scouted-but-unowned tiles (owned preferred). */
    unowned_path_penalty: z.number(),
    /** Reinforce detachment cost/time multiplier (path known/cleared). */
    reinforce_cost_multiplier: z.number(),
    /** How long the party waits at destination before auto-recall (virtual minutes). */
    arrival_decision_minutes: z.number(),
    _note: z.string(),
  }),

  research: z.object({
    _status: z.string(),
    troop_speed: z.object({
      tier_2: z.object({ multiplier: z.number(), cost: resourceCostMap, duration_minutes: z.number() }),
      tier_3: z.object({ multiplier: z.number(), cost: resourceCostMap, duration_minutes: z.number() }),
    }),
    game_speed: z.object({
      tier_2: z.object({ rate: z.number(), cost: resourceCostMap, duration_minutes: z.number() }),
      tier_3: z.object({ rate: z.number(), cost: resourceCostMap, duration_minutes: z.number() }),
    }),
    parallel_upgrades: z.object({
      cost: resourceCostMap,
      duration_minutes: z.number(),
      /** Timed-task slots per structure (and base hub) once researched — default cap is 1. */
      task_slots: z.number(),
    }),
    improved_optics: z.object({
      cost: resourceCostMap,
      duration_minutes: z.number(),
      /** Axial spiral radius revealed per wandering-scout step (land only). 0 without research. */
      wandering_scout_reveal_radius: z.number(),
      /** Axial spiral radius free-claimed around each territory-expedition path tile. 0 without research. */
      expedition_own_range: z.number(),
    }),
  }),

  noise: z.object({
    cap_base: z.number(),
    cap_per_level: z.number(),
    _cap_note: z.string(),
    noise_floor_minimum: z.number(),
    _noise_floor_minimum_note: z.string(),
    floor_convergence_half_life_seconds: z.number(),
    _floor_convergence_note: z.string(),
    _one_time_action_noise_note: z.string(),
    one_time_action_noise: numberRecord,
    passive_gathering_noise_floor: z
      .object({
        food: z.number(),
        wood: z.number(),
        stone: z.number(),
        steel: z.number(),
      })
      .catchall(z.string()),
    extraction_tier_noise_multiplier: z.number(),
    _extraction_tier_noise_note: z.string(),
    passive_watch_noise_floor: z
      .object({
        tower_per_level: z.number(),
        wall_per_tier_level: z.number(),
      })
      .catchall(z.string()),
  }),

  dens: z.object({
    _status: z.string(),
    count: z.number(),
    min_distance_from_base: z.number(),
    max_level: z.number(),
    max_relevant_distance: z.number(),
    horde_size_base: z.number(),
    level_cap_by_distance: z.object({
      _formula: z.string(),
      distance_per_level_step: z.number(),
    }),
    siege: z.object({
      den_defense_base: z.number(),
      den_defense_per_level: z.number(),
      hold_owned_radius: z.number(),
      hold_duration_minutes: z.number(),
      wave_interval_minutes: z.number(),
      wave_base: z.number(),
      wave_per_level: z.number(),
      wave_escalation_per_wave: z.number(),
      wave_cap: z.number(),
    }),
  }),

  scrap_stashes: z.object({
    _status: z.string(),
    count: z.number(),
    early_guarantee_max_distance: z.number(),
    tile_level_max: z.number(),
    art_variant_count: z.number(),
    steel_pool_by_terrain: z.object({
      shore: z.number(),
      grassland: z.number(),
      forest: z.number(),
      mountain: z.number(),
    }),
    /** Extra pool fraction per tile_level above 1 (e.g. 0.25 → L2 = 1.25×, L5 = 2×). */
    steel_pool_per_tile_level_pct: z.number(),
    terrain_placement_weight: z.object({
      shore: z.number(),
      grassland: z.number(),
      forest: z.number(),
      mountain: z.number(),
    }),
    wandering_scout_sample_steel: z.number(),
  }),

  scrap_yards: z.object({
    _status: z.string(),
    build_cost_base: resourceCostMap,
    build_cost_scaling: z.string(),
    build_time_minutes: z.number(),
    max_level: z.number(),
    max_level_shipped: z.number(),
    noise_passive_per_level: z.number(),
    scrapper: z.object({
      _status: z.string().optional(),
      /** Index by yard level; [0] unused. */
      capacity_by_level: z.array(z.number()),
      speed_multiplier_by_level: z.array(z.number()),
      /**
       * Seconds per Dijkstra path-cost unit for Scrapper legs — separate from
       * expeditions.travel_seconds_per_cost so mountain routes don't make steel
       * crawl (expeditions use 15; Scrappers are light salvage haulers).
       */
      travel_seconds_per_cost: z.number(),
      auto_next_stash_min_level: z.number(),
    }),
  }),

  outposts: z.object({
    starting_owned_radius: z.number(),
    reinforcement: z.object({
      base_hp: z.number(),
      hp_gain_per_level: z.number(),
      cost_base: resourceCostMap,
      upgrade_time_minutes_base: z.number(),
      seconds_per_missing_hp: z.number(),
    }),
  }),

  horde: z.object({
    spawn_check_interval_seconds: z.number(),
    spawn_chance_formula: z.string(),
    proximity_base_weight: z.number(),
    proximity_influence: z.number(),
    den_level_base_weight: z.number(),
    den_level_influence: z.number(),
    spawn_cooldown_minutes: z.number(),
    no_horde_noise_threshold_db: z.number(),
    level_scaling_base: z.number(),
    level_scaling_per_level: z.number(),
    size_formula: z.string(),
    speed_factor_at_zero_noise: z.number(),
    speed_factor_at_max_noise: z.number(),
    size_decay_pct_per_tile_at_zero_noise: z.number(),
    size_decay_pct_per_tile_at_max_noise: z.number(),
    structure_hp_per_invested_resource: z.number(),
    tower_range_slow_multiplier: z.number(),
    pathfinding: z.object({
      mode: z.string(),
      terrain_weight_preference: z.array(z.string()),
      terrain_avoided: z.array(z.string()),
      terrain_impassable: z.array(z.string()),
      terrain_cost: z.object({
        _status: z.string(),
        grassland: z.number(),
        forest: z.number(),
        shore: z.number(),
        mountain: z.number(),
        water: z.number().nullable(),
      }),
    }),
    tile_combat: z.object({
      advance_rate: z.string(),
      on_tile_win: z.string(),
      reclaim: z.string(),
      milestone_11_placeholder_resolution: z.string(),
    }),
    territory_disconnection: z.object({
      detection: z.string(),
      resource_loss: z.string(),
      building_state: z.string(),
      repair_cost_pct_of_original_build: z.number(),
      repair_time_minutes: z.number(),
    }),
  }),

  lab: z.object({
    _status: z.string(),
    min_distance_from_base: z.number(),
    guardian_defense: z.number(),
  }),

  lab_clues: z.object({
    _status: z.string(),
    total_clues: z.number(),
    clue_form: z.string(),
    final_search_area_radius_tiles: z.number(),
    passive_surfacing: z.object({
      per_watchtower_tick_base_chance: z.number(),
      watchtower_intel_tier_multiplier: z.number(),
      /** When true, watchtower signals stop after all den-clear clues are in. */
      stops_once_all_clues_collected: z.boolean(),
    }),
    den_clear_bonus: z.object({
      guaranteed_clue_per_den_clear: z.boolean(),
    }),
  }),

  _open_items: z.array(z.string()),
});

export type Tweaks = z.infer<typeof tweaksSchema>;
