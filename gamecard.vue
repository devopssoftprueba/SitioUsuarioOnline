<script setup lang="ts">
/**
 * Component for displaying game information
 * @component
 */

/**
 * Interface for game properties
 */
interface GameProps {
    id: number;
    name: string;
    thumbnail: string;
    isActive: boolean;
}

/**
 * Props definition for the component
 */
const props = defineProps<GameProps>();

/**
 * Emits definition for component events
 */
const emit = defineEmits<{
    (event: 'play', gameId: number): void;
    (event: 'favorite', gameId: number): void;
}>();

/**
 * Handles the play button click
 * @param gameId - The game identifier
 */
const handlePlay = (gameId: number): void => {
    emit('play', gameId);
};
</script>