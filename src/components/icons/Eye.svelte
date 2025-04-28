<script lang="ts">
  import { Eye, EyeOff } from '@lucide/svelte';

  type Props = {
    onChange: (show: boolean) => void;
  };
  const { onChange }: Props = $props();

  let show = $state(false);

  const id = 'eye-input';
</script>

<label class="swap bg-base-100 ml-3 mt-1" for={id}>
  <input {id} type="checkbox" class="hidden" bind:checked={show} onchange={() => onChange(show)} />

  <div class="swap-on mt-1">
    <!-- Show EyeOff when show = true -->
    <EyeOff class="w-6 h-6 text-white-700" />
  </div>

  <div class="swap-off mt-1">
    <!-- Show Eye when show = false -->
    <Eye class="w-6 h-6 text-white-700" />
  </div>
</label>
