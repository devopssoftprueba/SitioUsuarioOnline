<script setup lang="ts">
/**
 * Game card component.
 * Displays game information and provides interaction controls.
 */

import { ref, computed, defineProps, defineEmits } from 'vue';

/**
 * Interface that defines the component's props
 */
interface IGameProps {
  /** Unique identifier for the game */
  id: number;
  /** Name of the game */
  name: string;
  /** Game image URL */
  thumbnail: string;
  /** Indicates if the game is enabled */
  isActive: boolean;
  /** Indicates if the game is marked as favorite */
  isFavorite: boolean;
}

/** Component props definition */
const props = defineProps<IGameProps>();

/** Component events definition */
const emit = defineEmits<{
  /** Triggered when play button is clicked */
  (e: 'play', gameId: number): void;
  /** Triggered when favorite button is clicked */
  (e: 'favorite', gameId: number): void;
}>();

/** Tracks the selected state of the card */
const isSelected = ref<boolean>(false);

/** Computed property for uppercase game name */
const upperName = computed((): string => props.name.toUpperCase());

/**
 * Handles the play button click event
 */
function handlePlay(): void {
  emit('play', props.id);
}

function handleFavorite(): void {
  emit('favorite', props.id);
}
</script>

<template>
  <!-- Main card container -->
  <div class="game-card" :class="{ selected: isSelected }">
    <img :src="props.thumbnail" :alt="props.name" class="game-thumbnail" />
    <div class="game-title">{{ upperName }}</div>
    <button @click="handlePlay" :disabled="!props.isActive">Play</button>
    <button @click="handleFavorite">
      {{ props.isFavorite ? 'Remove favorite' : 'Add favorite' }}
    </button>
    <slot />
  </div>
</template>

<style scoped>
/* Game card container styles */
.game-card {
  border: 1px solid #ccc;
  padding: 16px;
}

/* Additional styles... */
</style>