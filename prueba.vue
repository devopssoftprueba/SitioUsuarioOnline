<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'; // Import Vue composition API functions
import apiService from '@/services/ApiService'; // Import API service for making requests
import { useAppcomponentStore } from '@/stores/AppComponent'; // Import store for application component state management
import IconLupa from '@/components/icons/menu/IconLupa.vue'; // Import icon component

// Access the app component state from the store
const appComponent = useAppcomponentStore().appComponent;

// Reactive references for search input and dimensions
const searchQuery = ref('');
const inputWidth = ref('0px');
const inputHeight = ref('0px');
const inputWidthCard = ref('0px');
const inputHeightCard = ref('0px');
const inputVisibility = ref('hidden');
const inputVisibilityCard = ref('hidden');
const showHeight = ref(false);
const searchContainer = ref<HTMLElement | null>(null); // Reference for the search container element
const searchInput = ref<HTMLElement | null>(null); // Reference for the search input element
const urlVirtualplay = ref<any>(''); // URL for virtual play
const onSearch = ref<boolean>(false); // State to track if a search is active
let debouncedSearch: any = null; // Variable to hold the debounced search function

// Function to toggle the visibility and dimensions of the search input
const toggleInput = () => {
  if (inputWidth.value === '0px') {
    inputWidth.value = '340px'; // Expand input width
    inputVisibility.value = 'visible'; // Set input visibility to visible
    setTimeout(() => {
      showHeight.value = true; // Show height after a delay
      inputHeight.value = '530px'; // Set input height
    }, 600);
  } else {
    inputWidth.value = '0px'; // Collapse input width
    inputVisibility.value = 'hidden'; // Hide input visibility
    showHeight.value = false; // Hide height
    inputHeight.value = '0px'; // Reset input height
    searchQuery.value = ''; // Clear search query
    inputWidthCard.value = '0px'; // Collapse card width
    inputHeightCard.value = '0px'; // Reset card height
    inputVisibilityCard.value = 'hidden'; // Hide card visibility
    showHeight.value = false; // Hide height
  }
};

// Function to handle search input when the user presses enter
const searchEnter = (event: Event) => {
  if (searchQuery.value.length >= 3) {
    // Check if search query length is sufficient
    const optionsGames = {
      action: 'getGames2', // Action type for the API request
      partner_id: appComponent.partnerG, // Partner ID from app component
      search: searchQuery.value, // Search query
      country: appComponent.country, // Country from app component
      typelobby: -1, // Lobby type
      isMobile: appComponent.mobile === '1' ? true : false, // Check if mobile
    };
    // Make API request to get games based on search query
    apiService.requestGet(urlVirtualplay.value + '/cms/products/games/', optionsGames).then((response: any) => {
      appComponent.gamesListSearch = response.data.games; // Update games list in app component
      appComponent.total_count = response.data.total_count; // Update total count
      appComponent.offset = 0; // Reset offset
      appComponent.limit = appComponent.limit; // Maintain limit
      if (appComponent.gamesListSearch.length > 0) {
        // If games found
        if (inputWidthCard.value === '0px') {
          inputWidthCard.value = '350px'; // Expand card width
          inputVisibilityCard.value = 'visible'; // Set card visibility to visible
          setTimeout(() => {
            showHeight.value = true; // Show height after a delay
            inputHeightCard.value = 'auto'; // Set card height to auto
          }, 200);
        } else {
          inputWidthCard.value = '0px'; // Collapse card width
          inputHeightCard.value = 'hidden'; // Hide card height
          showHeight.value = false; // Hide height
          inputHeightCard.value = '0px'; // Reset card height
        }
      }
      // Check for Playtech jackpot configuration
      if (appComponent.config.casino?.playtechJackpot?.[appComponent.country]) {
        const existingScript = document.querySelector(
            'script[src="https://tickers.playtech.com/jackpots/new_jackpotjs.js"]', // Check if script already exists
        );
        if (existingScript) {
          existingScript.remove(); // Remove existing script
        }
        const script = document.createElement('script'); // Create new script element
        script.src = 'https://tickers.playtech.com/jackpots/new_jackpotjs.js'; // Set script source
        script.onload = () => {
          // On script load
          appComponent.gamesList.forEach((game) => {
            if (game.provider === 'PLAYTECH' && game.jackpot === 1) {
              // Check for Playtech games with jackpot
              const objParams = appComponent.config.casino.playtechJackpot[appComponent.country]; // Get jackpot parameters
              objParams.game = game.front_game_id; // Set game ID
              const ticker = new Ticker(objParams); // Create new ticker instance
              ticker.attachToTextBox('playtech-' + game.id); // Attach ticker to game ID
              ticker.SetCurrencyPos('1'); // Set currency position
              ticker.tick(); // Start ticker
            }
          });
        };
        document.head.appendChild(script); // Append script to document head
      }
    });
  } else {
    appComponent.gamesListSearch = []; // Clear search results if query is too short
  }
};

// Debounce function to limit the rate of function execution
const debounce = (func: Function, wait: number) => {
  let timeout: any; // Timeout variable
  return function (...args: any[]) {
    clearTimeout(timeout); // Clear previous timeout
    timeout = setTimeout(() => func.apply(this, args), wait); // Set new timeout
  };
};

// Function to handle clicks outside the search container
const handleClickOutside = (event: MouseEvent) => {
  if (searchContainer.value && !searchContainer.value.contains(event.target as Node)) {
    inputWidth.value = '0px'; // Collapse input width
    inputVisibility.value = 'hidden'; // Hide input visibility
    showHeight.value = false; // Hide height
    inputHeight.value = '0px'; // Reset input height
    inputWidthCard.value = '0px'; // Collapse card width
    inputHeightCard.value = '0px'; // Reset card height
    inputVisibilityCard.value = 'hidden'; // Hide card visibility
  }
};

// Function to open a game when clicked
const onOpenGame = (game, $event) => {
  if (appComponent.session.logueado) {
    // Check if user is logged in
    appComponent.gamesListSearch.idSelect = game.id; // Set selected game ID
    appComponent.openLink = true; // Set flag to open link
    appComponent.openGame(game); // Open the selected game
    appComponent.showGame = true; // Show game
    onSearch.value = false; // Reset search state
    $event.stopPropagation(); // Stop event propagation
  } else {
    appComponent.showModalLogin = true; // Show login modal if not logged in
  }
};

// Lifecycle hook to run on component mount
onMounted(() => {
  urlVirtualplay.value = appComponent.config.urlVirtualplay; // Set virtual play URL
  debouncedSearch = debounce(searchEnter, appComponent.config['timeDebouncedSearch'] ?? 500); // Initialize debounced search
  document.addEventListener('click', handleClickOutside); // Add event listener for clicks outside
});

// Lifecycle hook to run before component unmount
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside); // Remove event listener
});
</script>

<template>
  <!-- Main search container with flex layout -->
  <div
      v-bind="$attrs"
      class="flex items-center justify-center gap-[0.50rem]"
      ref="searchContainer"
  >
    <!-- Button to toggle search input visibility -->
    <button @click="toggleInput">
      <IconLupa
          class="w-[30px] h-[30px] flex justify-center items-center fill-neutral hover:fill-accent-content"
      />
    </button>
    <!-- Search input container -->
    <div
        class="rounded-full absolute h-[30px] right-[30px] md:right-[310px]"
        :style="{ width: inputWidth, visibility: inputVisibility }"
    >
      <!-- Search input field -->
      <input
          v-model="searchQuery"
          @input="debouncedSearch"
          ref="searchInput"
          id="search-input"
          placeholder="Buscar..."
          type="text"
          :style="{ width: inputWidth }"
          class="rounded-full border-[2px] border-accent-content text-gray-600 absolute bottom-1 transform right-[2px] h-[30px]"
      />
    </div>
  </div>
  <!-- Search results container -->
  <div
      v-if="appComponent.gamesListSearch.length > 0"
      id="search-input-two"
      class="w-full bg-neutral border-[2px] border-primary-content absolute z-[60] top-[42px] right-[16px] sm:right-[60px] transition-all duration-300 ease-out p-2"
      :style="{
            width: inputWidthCard,
            height: 'auto',
            maxHeight: '430px',
            visibility: inputVisibilityCard,
            display: 'flex',
            flexDirection: 'column',
        }"
  >
    <div class="bg-base-200/80 rounded-lg shadow-lg flex-1 overflow-auto p-1">
      <!-- Loop through search results and display each game -->
      <div
          v-for="game in appComponent.gamesListSearch"
          :key="game.id"
          class="bg-secondary-content relative rounded-xl h-36 w-full flex justify-center items-center gap-1 p-1 mb-4"
      >
        <img
            :src="game.icon_3"
            alt=""
            class="h-32 rounded-xl"
        />
        <div class="flex flex-col justify-center items-center gap-4 w-full h-full p-2 break-all">
          <p class="text-neutral text-lg text-center font-bold">{{ game.name }}</p>
          <button
              class="bg-secondary text-neutral text-sm w-40 rounded-full font-bold p-2 uppercase hover:scale-105"
              @click="onOpenGame(game, $event)"
          >
            Play Now
          </button>
        </div>
      </div>
      <!-- Button to close search results -->
      <button
          @click="toggleInput"
          :style="{ visibility: inputVisibilityCard, color: '#FFFFFF' }"
          class="bg-gray-600 hover:bg-gray-400 text-neutral p-2 rounded-md mt-4 w-full"
      >
        X
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Styles for the search input field */
#search-input {
  padding: 10px; /* Padding for input */
  font-size: 16px; /* Font size for input */
  border: 2px solid #ccc; /* Border style for input */
  border-radius: 25px; /* Rounded corners for input */
  outline: none; /* Remove outline */
  transition:
      500ms width ease-in-out,
        /* Transition for width */ 500ms padding ease-in-out,
        /* Transition for padding */ 500ms border-radius ease-in-out; /* Transition for border radius */
}

/* Styles for the search results container */
#search-input-two {
  width: 310px !important; /* Fixed width for results */
  padding: 10px; /* Padding for results */
  font-size: 16px; /* Font size for results */
  border: 2px solid #ccc; /* Border style for results */
  border-radius: 10px; /* Rounded corners for results */
  outline: none; /* Remove outline */
  transition:
      width 500ms ease-in-out,
        /* Transition for width */ height 900ms ease-in-out; /* Transition for height */
}

/* Custom scrollbar styles */
.scroll__custom::-webkit-scrollbar-track {
  -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3); /* Shadow for scrollbar track */
  border-radius: 10px; /* Rounded corners for track */
  background-color: #f5f5f5; /* Background color for track */
}
.scroll__custom::-webkit-scrollbar {
  width: 12px; /* Width of scrollbar */
  background-color: #f5f5f5; /* Background color for scrollbar */
}
.scroll__custom::-webkit-scrollbar-thumb {
  border-radius: 10px; /* Rounded corners for scrollbar thumb */
  -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3); /* Shadow for thumb */
  background-color: #555; /* Background color for thumb */
}
</style>

<!-- FILE DOCUMENTED -->
