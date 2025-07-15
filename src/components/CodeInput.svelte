<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Share, Copy, Eye, EyeOff } from '@lucide/svelte';
  import { Capacitor } from '@capacitor/core';
  import { Share as CapacitorShare } from '@capacitor/share';
  import { addToastMessage } from '../stores/toastStore';

  interface Props {
    value: string;
    placeholder?: string;
    label?: string;
    readonly?: boolean;
    showVisibilityToggle?: boolean;
    showCopyButton?: boolean;
    showShareButton?: boolean;
    codeLength?: number;
    autoFocus?: boolean;
  }

  let {
    value = $bindable(),
    placeholder = '',
    label = '',
    readonly = false,
    showVisibilityToggle = true,
    showCopyButton = true,
    showShareButton = true,
    codeLength = 6,
    autoFocus = false
  }: Props = $props();

  const dispatch = createEventDispatcher();
  const isMobile = Capacitor.isNativePlatform();

  let isVisible = $state(false);
  let inputRefs: HTMLInputElement[] = [];
  let currentIndex = $state(0);
  let codeDigits = $state<string[]>([]);

  // Initialize code digits from value
  $effect(() => {
    if (value) {
      codeDigits = value.split('').slice(0, codeLength);
      // Pad with empty strings if needed
      while (codeDigits.length < codeLength) {
        codeDigits.push('');
      }
    } else {
      codeDigits = new Array(codeLength).fill('');
    }
  });

  // Update value when codeDigits change
  $effect(() => {
    value = codeDigits.join('');
    dispatch('input', value);
  });

  function focusInput(index: number) {
    if (inputRefs[index] && !readonly) {
      inputRefs[index].focus();
      currentIndex = index;
    }
  }

  function handleInput(event: Event, index: number) {
    const target = event.target as HTMLInputElement;
    const inputValue = target.value;

    if (inputValue.length > 1) {
      // Handle paste or multiple characters
      const chars = inputValue.split('').slice(0, codeLength - index);
      chars.forEach((char, i) => {
        if (index + i < codeLength) {
          codeDigits[index + i] = char;
        }
      });

      // Focus next available input or last input
      const nextIndex = Math.min(index + chars.length, codeLength - 1);
      focusInput(nextIndex);
    } else {
      // Single character input
      codeDigits[index] = inputValue;

      // Auto-move to next input
      if (inputValue && index < codeLength - 1) {
        focusInput(index + 1);
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const { key } = event;

    switch (key) {
      case 'ArrowLeft':
        event.preventDefault();
        if (index > 0) {
          focusInput(index - 1);
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (index < codeLength - 1) {
          focusInput(index + 1);
        }
        break;

      case 'Backspace':
        event.preventDefault();
        if (codeDigits[index]) {
          codeDigits[index] = '';
        } else if (index > 0) {
          codeDigits[index - 1] = '';
          focusInput(index - 1);
        }
        break;

      case 'Delete':
        event.preventDefault();
        codeDigits[index] = '';
        break;

      case 'Home':
        event.preventDefault();
        focusInput(0);
        break;

      case 'End':
        event.preventDefault();
        focusInput(codeLength - 1);
        break;

      case 'Tab':
        // Allow natural tab navigation
        break;

      default:
        // Only allow alphanumeric characters
        if (!/^[a-zA-Z0-9]$/.test(key)) {
          event.preventDefault();
        }
        break;
    }
  }

  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const chars = pastedText.split('').slice(0, codeLength);

    chars.forEach((char, i) => {
      if (i < codeLength) {
        codeDigits[i] = char;
      }
    });

    // Focus the last filled input or the next empty one
    const nextIndex = Math.min(chars.length, codeLength - 1);
    focusInput(nextIndex);
  }

  async function copyCode() {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      addToastMessage('Code copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy code:', error);
      addToastMessage('Failed to copy code', 'error');
    }
  }

  async function shareCode() {
    if (!value) return;

    try {
      if (isMobile && CapacitorShare) {
        await CapacitorShare.share({
          title: 'File Transfer Code',
          text: value,
          dialogTitle: 'Share Code'
        });
      } else {
        // Web fallback
        if (navigator.share) {
          await navigator.share({
            title: 'File Transfer Code',
            text: value
          });
        } else {
          // Fallback to copy
          await copyCode();
        }
      }
    } catch (error) {
      console.error('Failed to share code:', error);
      addToastMessage('Failed to share code', 'error');
    }
  }

  onMount(() => {
    if (autoFocus && !readonly) {
      setTimeout(() => focusInput(0), 100);
    }
  });
</script>

<div class="code-input-container">
  {#if label}
    <label class="label">
      <span class="label-text font-medium">{label}</span>
    </label>
  {/if}

  <div class="relative">
    <!-- Code Input Grid -->
    <div class="code-input-grid" class:readonly>
      {#each Array(codeLength) as _, index}
        <input
          bind:this={inputRefs[index]}
          type={isVisible ? 'text' : 'password'}
          class="code-input-digit"
          class:active={currentIndex === index}
          class:filled={codeDigits[index]}
          bind:value={codeDigits[index]}
          {placeholder}
          {readonly}
          maxlength="1"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          oninput={(e) => handleInput(e, index)}
          onkeydown={(e) => handleKeyDown(e, index)}
          onfocus={() => !readonly && (currentIndex = index)}
          onpaste={index === 0 ? handlePaste : undefined}
        />
      {/each}
    </div>

    <!-- Action Buttons -->
    {#if (showVisibilityToggle || showCopyButton || showShareButton) && value}
      <div class="code-input-actions">
        {#if showVisibilityToggle}
          <button
            type="button"
            class="code-action-btn"
            onclick={() => isVisible = !isVisible}
            aria-label="Toggle visibility"
          >
            {#if isVisible}
              <EyeOff size={18} />
            {:else}
              <Eye size={18} />
            {/if}
          </button>
        {/if}

        {#if showCopyButton}
          <button
            type="button"
            class="code-action-btn"
            onclick={copyCode}
            aria-label="Copy code"
          >
            <Copy size={18} />
          </button>
        {/if}

        {#if showShareButton}
          <button
            type="button"
            class="code-action-btn"
            onclick={shareCode}
            aria-label="Share code"
          >
            <Share size={18} />
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Mobile Helper Text -->
  {#if isMobile && !readonly}
    <div class="code-input-helper">
      <span class="text-sm opacity-70">
        Tap any box to edit • Use arrow keys to navigate
      </span>
    </div>
  {/if}
</div>

<style>
  .code-input-container {
    @apply w-full;
  }

  .code-input-grid {
    @apply flex gap-2 justify-center items-center relative;
  }

  .code-input-grid.readonly {
    @apply opacity-75;
  }

  .code-input-digit {
    @apply
      w-12 h-12
      text-center text-lg font-mono font-semibold
      border-2 rounded-lg
      transition-all duration-200
      focus:outline-none
      bg-base-100
      border-base-300
      text-base-content
      placeholder:text-base-content/30;
  }

  .code-input-digit:focus {
    @apply border-primary ring-2 ring-primary/20;
  }

  .code-input-digit.active {
    @apply border-primary/50;
  }

  .code-input-digit.filled {
    @apply border-success/50 bg-success/5;
  }

  .code-input-digit[readonly] {
    @apply cursor-default;
  }

  .code-input-actions {
    @apply
      absolute -right-2 top-1/2 -translate-y-1/2
      flex flex-col gap-1
      ml-4;
  }

  .code-action-btn {
    @apply
      p-2 rounded-lg
      transition-all duration-200
      hover:bg-base-200
      focus:outline-none focus:ring-2 focus:ring-primary/20
      text-base-content/70 hover:text-base-content
      bg-base-100 border border-base-300;
  }

  .code-input-helper {
    @apply mt-2 text-center;
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .code-input-digit {
      @apply w-10 h-10 text-base;
    }

    .code-input-actions {
      @apply -right-1;
    }

    .code-action-btn {
      @apply p-1.5;
    }
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .code-input-digit {
      @apply bg-base-200;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .code-input-digit {
      @apply border-4;
    }
  }
</style>