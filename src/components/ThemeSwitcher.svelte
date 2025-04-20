<script>
  import { onMount } from 'svelte';
  import 'theme-change';

  onMount(() => {
    // theme-change auto-initializes
  });

  const themes = [
    "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
    "synthwave", "retro", "cyberpunk", "valentine", "halloween",
    "garden", "forest", "aqua", "lofi", "pastel", "fantasy",
    "wireframe", "black", "luxury", "dracula", "cmyk", "autumn",
    "business", "acid", "lemonade", "night", "coffee", "winter"
  ];
</script>

<select class="select select-bordered w-full max-w-xs" data-choose-theme>
  <option disabled selected>Pick a theme</option>
  {#each themes as theme}
    <option value={theme}>{theme}</option>
  {/each}
</select>
