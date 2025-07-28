<script lang="ts">
  import QrScanner from 'qr-scanner';
  import { onMount, onDestroy } from 'svelte';
  import { ScanLine, ScanQrCode, Camera, RotateCcw, Upload, Image as ImageIcon, Sun, Moon, Zap, Flashlight, Smartphone, Monitor, Package } from '@lucide/svelte';

  interface Props {
    onScanSuccess: (data: string) => void;
    buttonText?: string;
    modalTitle?: string;
    autoStart?: boolean;
    continuousScanning?: boolean;
    allowImageUpload?: boolean;
    theme?: 'light' | 'dark' | 'auto';
  }

  let {
    onScanSuccess,
    buttonText = 'Scan QR Code',
    modalTitle = 'Scan QR Code',
    autoStart = false,
    continuousScanning = false,
    allowImageUpload = true,
    theme = 'auto'
  }: Props = $props();

  // Core state
  let isModalOpen = $state(false);
  let qrScanner = $state<QrScanner | null>(null);
  let videoElement = $state<HTMLVideoElement | null>(null);
  let isCameraActive = $state(false);
  let errorMessage = $state('');
  let permissionRequested = $state(false);
  let isScanning = $state(false);
  let scanCount = $state(0);
  let lastScanTime = $state(0);
  let availableCameras = $state<QrScanner.Camera[]>([]);
  let currentCameraIndex = $state(0);
  let isFlipped = $state(false);
  let scanningIndicator = $state(false);

  // Image upload state
  let fileInput = $state<HTMLInputElement | null>(null);
  let isProcessingImage = $state(false);
  let uploadedImageUrl = $state<string | null>(null);
  let scanMode = $state<'camera' | 'image'>('camera');

  // Platform detection
  let platform = $state<'browser' | 'electron' | 'flatpak' | 'mobile'>('browser');
  let deviceType = $state<'desktop' | 'tablet' | 'mobile'>('desktop');
  let operatingSystem = $state<'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown'>('unknown');
  let currentTheme = $state<'light' | 'dark'>('light');
  let hasFlashlight = $state(false);
  let isFlashlightOn = $state(false);
  let nativePermissionStatus = $state<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  let isLandscape = $state(false);

  // Native integration
  let electronAPI = $state<any>(null);
  let nativeStreamConstraints = $state<MediaStreamConstraints | null>(null);
  let supportedConstraints = $state<MediaTrackSupportedConstraints | null>(null);

  // Scanner configuration
  let scannerConfig = $derived({
    highlightScanRegion: true,
    highlightCodeOutline: true,
    preferredCamera: availableCameras[currentCameraIndex]?.id || 'environment',
    maxScansPerSecond: getOptimalScanRate(),
    calculateScanRegion: (video: HTMLVideoElement) => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const smallerDimension = Math.min(video.videoWidth, video.videoHeight);
      const scanRegionSize = Math.round(0.85 * smallerDimension);

      return {
        x: Math.round((video.videoWidth - scanRegionSize) / 2),
        y: Math.round((video.videoHeight - scanRegionSize) / 2),
        width: scanRegionSize,
        height: scanRegionSize,
        downScaledWidth: Math.round(600 * devicePixelRatio),
        downScaledHeight: Math.round(600 * devicePixelRatio),
      };
    },
    returnDetailedScanResult: true,
    highlightCodeOutlineColor: currentTheme === 'dark' ? '#00ff88' : '#00aa44',
    highlightScanRegionColor: currentTheme === 'dark' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(0, 170, 68, 0.15)',
  });

  function getOptimalScanRate(): number {
    if (platform === 'flatpak') return 25;
    if (platform === 'mobile' || deviceType === 'mobile') return 30;
    if (platform === 'electron') return 45;
    return 60;
  }

  // Theme classes
  let themeClasses = $derived({
    modal: currentTheme === 'dark' ? 'bg-base-300/30 backdrop-blur-2xl border border-base-content/20 shadow-2xl' : 'bg-base-100/30 backdrop-blur-2xl border border-base-content/20 shadow-2xl',
    card: currentTheme === 'dark' ? 'bg-base-200/40 backdrop-blur-lg border border-base-content/30' : 'bg-base-100/40 backdrop-blur-lg border border-base-content/30',
    button: currentTheme === 'dark' ? 'bg-base-content/15 hover:bg-base-content/25 backdrop-blur-sm border border-base-content/30' : 'bg-base-content/10 hover:bg-base-content/20 backdrop-blur-sm border border-base-content/30',
    text: currentTheme === 'dark' ? 'text-base-content' : 'text-base-content',
    accent: currentTheme === 'dark' ? 'text-accent' : 'text-primary'
  });

  // Modal size
  let modalSize = $derived(() => {
    if (deviceType === 'mobile') return 'w-full max-w-sm mx-4';
    if (deviceType === 'tablet') return 'w-full max-w-md mx-6';
    return 'w-full max-w-lg mx-8';
  });

  onMount(async () => {
    await initializePlatformDetection();
    await initializeNativeIntegrations();
    initializeTheme();
    setupResponsiveHandlers();
    await setupCameraSystem();
    setupPlatformEventListeners();

    if (autoStart) {
      toggleModal(true);
    }

    return () => cleanupAll();
  });

  onDestroy(() => cleanupAll());

  async function initializePlatformDetection() {
    if (typeof window === 'undefined') return;

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    deviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    if (/android/i.test(userAgent)) operatingSystem = 'android';
    else if (/iphone|ipad|ipod/i.test(userAgent)) operatingSystem = 'ios';
    else if (/mac/i.test(userAgent)) operatingSystem = 'macos';
    else if (/win/i.test(userAgent)) operatingSystem = 'windows';
    else if (/linux/i.test(userAgent)) operatingSystem = 'linux';

    if (window.electronAPI) {
      electronAPI = window.electronAPI;
      platform = (await checkFlatpakEnvironment()) ? 'flatpak' : 'electron';
    } else if (deviceType === 'mobile') {
      platform = 'mobile';
    } else {
      platform = 'browser';
    }

    console.log('Platform Detection:', { platform, deviceType, operatingSystem });
  }

  async function checkFlatpakEnvironment(): Promise<boolean> {
    try {
      if (electronAPI?.ipcRenderer) {
        const result = await electronAPI.ipcRenderer.invoke('check-flatpak-environment');
        return result?.isFlatpak || false;
      }
    } catch (e) {
      console.warn('Could not check Flatpak environment:', e);
    }
    return false;
  }

  async function initializeNativeIntegrations() {
    if (platform === 'electron' || platform === 'flatpak') {
      await setupElectronIntegration();
    }
    if (navigator.mediaDevices) {
      supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
    }
  }

  async function setupElectronIntegration() {
    if (!electronAPI?.ipcRenderer) return;

    try {
      const permissionResult = await electronAPI.ipcRenderer.invoke('request-camera-permission', { platform, operatingSystem });
      nativePermissionStatus = permissionResult?.status || 'unknown';

      if (platform === 'flatpak') {
        await setupFlatpakIntegration();
      }

      nativeStreamConstraints = await electronAPI.ipcRenderer.invoke('get-optimal-camera-constraints', { platform, deviceType, operatingSystem });
    } catch (error) {
      console.warn('Native integration setup failed:', error);
      handleNativeIntegrationError(error);
    }
  }

  async function setupFlatpakIntegration() {
    if (!electronAPI?.ipcRenderer) return;

    try {
      const flatpakPerms = await electronAPI.ipcRenderer.invoke('check-flatpak-permissions');
      if (!flatpakPerms?.camera) {
        const granted = await electronAPI.ipcRenderer.invoke('request-flatpak-camera-permission');
        if (!granted) {
          errorMessage = 'Flatpak camera permission required. Run: flatpak permission-set camera com.yourapp.name yes';
          return;
        }
      }

      nativeStreamConstraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
          facingMode: 'environment'
        }
      };
    } catch (error) {
      console.warn('Flatpak integration failed:', error);
      errorMessage = 'Flatpak camera setup failed. Check permissions and portal access.';
    }
  }

  function handleNativeIntegrationError(error: any) {
    const errorMsg = error?.message || String(error);
    errorMessage = platform === 'flatpak'
      ? `Flatpak integration error: ${errorMsg}. Ensure camera portal access.`
      : `Electron integration error: ${errorMsg}. Check native module dependencies.`;
  }

  function initializeTheme() {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      currentTheme = mediaQuery.matches ? 'dark' : 'light';
      mediaQuery.addEventListener('change', (e) => {
        currentTheme = e.matches ? 'dark' : 'light';
        updateDocumentTheme();
      });
    } else {
      currentTheme = theme;
    }
    updateDocumentTheme();
  }

  function updateDocumentTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (deviceType === 'mobile') {
      updateMobileViewport();
    }
  }

  function updateMobileViewport() {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }

  function setupResponsiveHandlers() {
    if (typeof window === 'undefined') return;

    const handleOrientationChange = () => {
      isLandscape = window.matchMedia('(orientation: landscape)').matches;
      if (deviceType === 'mobile' && isModalOpen && isCameraActive) {
        setTimeout(() => restartScanner(), 500);
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    handleOrientationChange();
  }

  async function setupCameraSystem() {
    try {
      availableCameras = await QrScanner.listCameras(true);
      if (availableCameras.length > 0) {
        await checkFlashlightSupport();
      }
    } catch (error) {
      console.warn('Camera system setup failed:', error);
      handleCameraSystemError(error);
    }
  }

  function handleCameraSystemError(error: any) {
    const errorMsg = error?.message || String(error);
    errorMessage = platform === 'flatpak' ? `Flatpak camera access error: ${errorMsg}. Check permissions and hardware.`
      : platform === 'mobile' ? `Mobile camera error: ${errorMsg}. Check browser permissions.`
      : platform === 'electron' ? `Electron camera error: ${errorMsg}. Check system permissions.`
      : `Camera error: ${errorMsg}`;
  }

  function setupPlatformEventListeners() {
    if ((platform === 'electron' || platform === 'flatpak') && electronAPI?.ipcRenderer) {
      electronAPI.ipcRenderer.on('auto-open-qr-scanner', () => toggleModal(true));
      electronAPI.ipcRenderer.on('camera-permission-changed', (_: any, data: any) => {
        nativePermissionStatus = data.status;
        if (data.status === 'granted' && isModalOpen && !isCameraActive) {
          startScanner();
        }
      });
      if (platform === 'flatpak') {
        electronAPI.ipcRenderer.on('flatpak-permission-granted', () => {
          if (isModalOpen && scanMode === 'camera') {
            startScanner();
          }
        });
      }
    }
    if (deviceType === 'mobile') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && isCameraActive) {
          pauseScanner();
        } else if (!document.hidden && isModalOpen && scanMode === 'camera') {
          resumeScanner();
        }
      });
    }
  }

  async function checkFlashlightSupport() {
    try {
      const constraints = getNativeConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];
      hasFlashlight = !!videoTrack.getCapabilities().torch;
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      hasFlashlight = false;
      console.warn('Could not check flashlight support:', e);
    }
  }

  function getNativeConstraints(): MediaStreamConstraints {
    const baseConstraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: getOptimalWidth(), min: 640 },
        height: { ideal: getOptimalHeight(), min: 480 },
        frameRate: { ideal: getOptimalScanRate(), min: 15 }
      }
    };
    if (nativeStreamConstraints?.video) {
      Object.assign(baseConstraints.video, nativeStreamConstraints.video);
    }
    Object.assign(baseConstraints.video, getPlatformSpecificConstraints());
    return baseConstraints;
  }

  function getOptimalWidth(): number {
    if (platform === 'flatpak') return 1280;
    if (deviceType === 'mobile') return isLandscape ? 1920 : 1080;
    if (platform === 'electron') return 1920;
    return 1920;
  }

  function getOptimalHeight(): number {
    if (platform === 'flatpak') return 720;
    if (deviceType === 'mobile') return isLandscape ? 1080 : 1920;
    if (platform === 'electron') return 1080;
    return 1080;
  }

  function getPlatformSpecificConstraints(): any {
    const constraints: any = {};
    if (supportedConstraints) {
      if (supportedConstraints.focusMode) constraints.focusMode = 'continuous';
      if (supportedConstraints.exposureMode) constraints.exposureMode = 'continuous';
      if (supportedConstraints.whiteBalanceMode) constraints.whiteBalanceMode = 'continuous';
    }
    if (deviceType === 'mobile') {
      constraints.aspectRatio = isLandscape ? 16/9 : 9/16;
      if (operatingSystem === 'ios') constraints.frameRate = { ideal: 30, min: 15 };
    }
    if (platform === 'flatpak') {
      constraints.frameRate = { ideal: 25, min: 15 };
      constraints.aspectRatio = 16/9;
    }
    return constraints;
  }

  async function requestCameraPermission(): Promise<boolean> {
    errorMessage = '';
    permissionRequested = true;

    if ((platform === 'electron' || platform === 'flatpak') && electronAPI) {
      try {
        const result = await electronAPI.ipcRenderer.invoke('request-camera-permission', { platform, operatingSystem });
        nativePermissionStatus = result?.status || 'unknown';
        return result?.granted || false;
      } catch (error) {
        console.warn('Native permission request failed:', error);
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      errorMessage = 'Camera access not supported in this browser.';
      return false;
    }

    try {
      const constraints = getNativeConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(track => track.stop());
      nativePermissionStatus = 'granted';
      return true;
    } catch (err) {
      handlePermissionError(err);
      return false;
    }
  }

  function handlePermissionError(error: Error) {
    nativePermissionStatus = 'denied';
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = platform === 'flatpak' ? 'Flatpak camera access denied. Run: flatpak permission-set camera com.yourapp.name yes'
        : platform === 'electron' ? 'Camera access denied. Check system privacy settings.'
        : deviceType === 'mobile' ? (operatingSystem === 'ios' ? 'Camera access denied. Enable in iOS Settings > Safari > Camera.'
          : operatingSystem === 'android' ? 'Camera access denied. Enable in Android Settings.'
          : 'Camera access denied. Allow in browser settings.')
        : getDesktopPermissionMessage();
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMessage = 'No camera found. Please connect a camera and try again.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMessage = 'Camera is busy. Close other applications using the camera.';
    } else if (error.name === 'OverconstrainedError') {
      errorMessage = 'Camera constraints not supported. Retrying with basic settings...';
      setTimeout(() => startScannerWithBasicConstraints(), 1000);
    } else {
      errorMessage = `Camera error: ${error.message || 'Unknown error'}`;
    }
  }

  function getDesktopPermissionMessage(): string {
    if (operatingSystem === 'macos') return 'Camera access denied. Check System Preferences > Security & Privacy > Camera.';
    if (operatingSystem === 'windows') return 'Camera access denied. Check Windows Settings > Privacy > Camera.';
    if (operatingSystem === 'linux') return 'Camera access denied. Check browser permissions and system camera access.';
    return 'Camera access denied. Allow in browser settings.';
  }

  async function startScanner() {
    if (!videoElement) {
      errorMessage = 'Video element not found. Waiting for DOM...';
      await waitForVideoElement();
      if (!videoElement) {
        errorMessage = 'Video element unavailable after waiting.';
        return;
      }
    }

    if (!permissionRequested) {
      const permissionGranted = await requestCameraPermission();
      if (!permissionGranted) return;
    }

    try {
      qrScanner = new QrScanner(videoElement, handleScanResult, scannerConfig);
      await qrScanner.start();
      isCameraActive = true;
      isScanning = true;
      errorMessage = '';
      await applyPlatformOptimizations();
      if (continuousScanning) setupContinuousScanning();
    } catch (err) {
      handleScannerError(err);
    }
  }

  async function startScannerWithBasicConstraints() {
    const basicConstraints: MediaStreamConstraints = {
      video: {
        facingMode: 'environment',
        width: { min: 320 },
        height: { min: 240 }
      }
    };
    await startScannerWithCustomConstraints(basicConstraints);
  }

  async function startScannerWithCustomConstraints(constraints: MediaStreamConstraints) {
    if (!videoElement) {
      errorMessage = 'Video element not available.';
      await waitForVideoElement();
      if (!videoElement) {
        errorMessage = 'Video element unavailable after waiting.';
        return;
      }
    }

    try {
      qrScanner = new QrScanner(videoElement, handleScanResult, {
        ...scannerConfig,
        onDecodeError: (error) => console.debug('QR decode attempt:', error)
      });
      setupScannerErrorHandling();
      await qrScanner.start();
      isCameraActive = true;
      isScanning = true;
      errorMessage = '';
      await applyPlatformOptimizations();
      if (continuousScanning) setupContinuousScanning();
    } catch (err) {
      handleScannerError(err);
    }
  }

  async function waitForVideoElement(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (videoElement?.parentNode) {
        resolve();
        return;
      }
      const observer = new MutationObserver(() => {
        if (videoElement?.parentNode) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        if (!videoElement?.parentNode) reject(new Error('Video element not found in DOM'));
      }, 5000);
    });
  }

  function setupScannerErrorHandling() {
    if (!qrScanner) return;
    try {
      if (qrScanner.addEventListener) {
        qrScanner.addEventListener('error', (event: any) => handleScannerError(event.detail || event));
      }
    } catch (e) {
      console.warn('Could not attach error listener:', e);
    }
  }

  async function applyPlatformOptimizations() {
    if (!qrScanner || !videoElement) return;
    try {
      const videoTrack = (videoElement.srcObject as MediaStream)?.getVideoTracks?.()?.[0];
      if (!videoTrack?.applyConstraints) return;

      const constraints: any = {};
      if (supportedConstraints?.focusMode) constraints.focusMode = 'continuous';
      if (supportedConstraints?.exposureMode) constraints.exposureMode = 'continuous';
      if (supportedConstraints?.whiteBalanceMode) constraints.whiteBalanceMode = 'continuous';
      if (platform === 'mobile' && operatingSystem === 'ios') constraints.frameRate = { ideal: 30 };
      else if (platform === 'flatpak') constraints.frameRate = { ideal: 25 };

      if (Object.keys(constraints).length > 0) {
        await videoTrack.applyConstraints(constraints);
      }
      applyQRScannerOptimizations();
    } catch (error) {
      console.warn('Could not apply platform optimizations:', error);
    }
  }

  function applyQRScannerOptimizations() {
    if (!qrScanner) return;
    try {
      if (typeof qrScanner.setGrayscaleWeights === 'function') {
        qrScanner.setGrayscaleWeights(0.2126, 0.7152, 0.0722, false);
      }
      if (typeof qrScanner.setInversionMode === 'function') {
        qrScanner.setInversionMode('both');
      }
    } catch (e) {
      console.warn('Could not apply QR scanner optimizations:', e);
    }
  }

  function setupContinuousScanning() {
    console.log('Continuous scanning enabled for', platform, 'on', deviceType);
  }

  function handleScannerError(err: any) {
    console.error('Scanner error:', err);
    const message = err instanceof Error ? err.message : typeof err === 'string' ? err : err?.message || String(err);
    errorMessage = `Scanner error: ${message}`;
    isCameraActive = false;
    isScanning = false;
    scanningIndicator = false;

    const isRetryableError = !errorMessage.toLowerCase().includes('denied') &&
                            !errorMessage.toLowerCase().includes('not found') &&
                            !errorMessage.toLowerCase().includes('not supported');
    if (isRetryableError && isModalOpen && scanMode === 'camera') {
      setTimeout(() => {
        if (isModalOpen && !isCameraActive && scanMode === 'camera') {
          console.log('Auto-retrying scanner...');
          startScanner();
        }
      }, getRetryDelay());
    }
  }

  function getRetryDelay(): number {
    if (platform === 'flatpak') return 3000;
    if (deviceType === 'mobile') return 2000;
    return 1000;
  }

  function pauseScanner() {
    if (qrScanner && isCameraActive) {
      try {
        qrScanner.stop();
        isCameraActive = false;
      } catch (e) {
        console.warn('Error pausing scanner:', e);
      }
    }
  }

  function resumeScanner() {
    if (qrScanner && !isCameraActive && isModalOpen && scanMode === 'camera') {
      qrScanner.start().then(() => {
        isCameraActive = true;
      }).catch(handleScannerError);
    }
  }

  function restartScanner() {
    stopScanner();
    setTimeout(() => {
      if (isModalOpen && scanMode === 'camera') startScanner();
    }, 500);
  }

  function stopScanner() {
    cleanupScanner();
    scanningIndicator = false;
  }

  function cleanupScanner() {
    if (qrScanner) {
      try {
        qrScanner.stop();
        qrScanner.destroy();
      } catch (e) {
        console.warn('Error cleaning up scanner:', e);
      }
      qrScanner = null;
    }
    isCameraActive = false;
    isScanning = false;
    isFlashlightOn = false;
  }

  function cleanupAll() {
    cleanupScanner();
    cleanupPlatformListeners();
    if (uploadedImageUrl) {
      URL.revokeObjectURL(uploadedImageUrl);
      uploadedImageUrl = null;
    }
  }

  function cleanupPlatformListeners() {
    if ((platform === 'electron' || platform === 'flatpak') && electronAPI?.ipcRenderer) {
      electronAPI.ipcRenderer.removeAllListeners('auto-open-qr-scanner');
      electronAPI.ipcRenderer.removeAllListeners('camera-permission-changed');
      electronAPI.ipcRenderer.removeAllListeners('flatpak-permission-granted');
    }
  }

  async function toggleFlashlight() {
    if (!hasFlashlight || !qrScanner || !videoElement?.srcObject) return;
    try {
      const videoTrack = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
      await videoTrack.applyConstraints({ advanced: [{ torch: !isFlashlightOn }] });
      isFlashlightOn = !isFlashlightOn;
    } catch (e) {
      console.warn('Flashlight not supported:', e);
    }
  }

  function handleScanResult(result: QrScanner.ScanResult) {
    const currentTime = Date.now();
    if (currentTime - lastScanTime < 500) return;
    lastScanTime = currentTime;
    scanCount++;
    scanningIndicator = true;
    setTimeout(() => scanningIndicator = false, 800);
    if (!continuousScanning) {
      stopScanner();
      isModalOpen = false;
    }
    onScanSuccess(result.data);
    if ((platform === 'electron' || platform === 'flatpak') && electronAPI?.ipcRenderer) {
      electronAPI.ipcRenderer.send('qr-scanned', {
        data: result.data,
        timestamp: currentTime,
        scanCount,
        platform,
        deviceType,
        operatingSystem
      });
    }
  }

  function handleFileSelect() {
    fileInput?.click();
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      errorMessage = 'Please select a valid image file.';
      return;
    }
    isProcessingImage = true;
    errorMessage = '';
    try {
      if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
      uploadedImageUrl = URL.createObjectURL(file);
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
        scanRegion: undefined,
        qrEngine: QrScanner.createQrEngine(),
        inversionAttempts: 'both'
      });
      handleImageScanResult(result);
    } catch (error) {
      console.error('Error scanning image:', error);
      errorMessage = 'No QR code found in the image. Try another image.';
    } finally {
      isProcessingImage = false;
      if (target) target.value = '';
    }
  }

  function handleImageScanResult(result: QrScanner.ScanResult) {
    const currentTime = Date.now();
    scanCount++;
    scanningIndicator = true;
    setTimeout(() => scanningIndicator = false, 500);
    isModalOpen = false;
    onScanSuccess(result.data);
    if ((platform === 'electron' || platform === 'flatpak') && electronAPI?.ipcRenderer) {
      electronAPI.ipcRenderer.send('qr-scanned', {
        data: result.data,
        timestamp: currentTime,
        scanCount,
        source: 'image',
        platform,
        deviceType,
        operatingSystem
      });
    }
  }

  async function switchCamera() {
    if (availableCameras.length <= 1 || !qrScanner) return;
    const previousIndex = currentCameraIndex;
    currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
    try {
      await qrScanner.setCamera(availableCameras[currentCameraIndex].id);
      setTimeout(() => applyPlatformOptimizations(), 500);
    } catch (err) {
      console.error('Failed to switch camera:', err);
      currentCameraIndex = previousIndex;
      restartScanner();
    }
  }

  function flipCamera() {
    isFlipped = !isFlipped;
    if (videoElement) {
      videoElement.style.transform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
    }
  }

  function switchScanMode(mode: 'camera' | 'image') {
    scanMode = mode;
    errorMessage = '';
    if (mode === 'camera') {
      if (uploadedImageUrl) {
        URL.revokeObjectURL(uploadedImageUrl);
        uploadedImageUrl = null;
      }
      if (!isCameraActive && (nativePermissionStatus === 'granted' || !permissionRequested)) {
        startScanner();
      }
    } else {
      stopScanner();
    }
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    updateDocumentTheme();
  }

  function toggleModal(open: boolean) {
    isModalOpen = open;
    if (open) {
      errorMessage = '';
      scanMode = 'camera';
      if (nativePermissionStatus === 'granted' || !permissionRequested) {
        startScanner();
      } else if (nativePermissionStatus === 'denied') {
        errorMessage = 'Camera permission was previously denied. Please allow camera access and try again.';
      }
    } else {
      stopScanner();
      scanCount = 0;
      if (uploadedImageUrl) {
        URL.revokeObjectURL(uploadedImageUrl);
        uploadedImageUrl = null;
      }
    }
  }

  async function retryScanner() {
    permissionRequested = false;
    nativePermissionStatus = 'unknown';
    errorMessage = '';
    const granted = await requestCameraPermission();
    if (granted) await startScanner();
  }

  function getPlatformIcon() {
    switch (platform) {
      case 'flatpak': return Package;
      case 'electron': return Monitor;
      case 'mobile': return Smartphone;
      default: return Camera;
    }
  }

  function getPlatformColor() {
    switch (platform) {
      case 'flatpak': return 'bg-warning';
      case 'electron': return 'bg-info';
      case 'mobile': return 'bg-secondary';
      default: return 'bg-success';
    }
  }
</script>

<button
  class="btn btn-ghost relative group overflow-hidden {themeClasses.button} transition-all duration-300 hover:scale-105 hover:shadow-xl {deviceType === 'mobile' ? 'btn-lg' : 'btn-md'}"
  onclick={() => toggleModal(true)}
  aria-label="Open QR Scanner"
>
  <div class="absolute inset-0 bg-gradient-to-r from-primary/30 to-secondary/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
  <ScanLine class="{scanningIndicator ? 'animate-pulse text-success scale-110' : 'group-hover:rotate-12'} relative z-10 transition-all duration-300" />
  <span class="relative z-10 {deviceType === 'mobile' ? 'text-sm' : 'text-base'}">{buttonText}</span>
  {#if scanCount > 0}
    <div class="absolute -top-2 -right-2 badge badge-success badge-sm animate-bounce shadow-lg backdrop-blur-sm">{scanCount}</div>
  {/if}
  <div class="absolute bottom-1 right-1 flex items-center gap-1">
    <div class="w-2 h-2 rounded-full {getPlatformColor()}"></div>
    {#if deviceType !== 'mobile'}
      <svelte:component this={getPlatformIcon()} class="w-3 h-3 opacity-60" />
    {/if}
  </div>
</button>

<input
  bind:this={fileInput}
  type="file"
  accept="image/*"
  onchange={handleFileChange}
  class="hidden"
  aria-label="Upload QR Code Image"
/>

{#if isModalOpen}
  <div class="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 {deviceType === 'mobile' ? 'p-2' : 'p-4'} animate-fade-in">
    <div class="{modalSize} {themeClasses.modal} rounded-3xl shadow-2xl animate-scale-in overflow-hidden max-h-[95vh] {deviceType === 'mobile' ? 'mx-2' : ''}">
      <div class="relative p-4 {deviceType === 'mobile' ? 'p-3' : 'p-6'} border-b border-base-content/20">
        <div class="absolute inset-0 opacity-10">
          <div class="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent"></div>
          <div class="absolute inset-0" style="background-image: radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 1px, transparent 1px); background-size: 15px 15px;"></div>
        </div>
        <div class="relative flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center backdrop-blur-sm border border-base-content/20">
              <ScanQrCode class="w-5 h-5 {themeClasses.accent}" />
            </div>
            <div>
              <h3 class="text-lg {deviceType === 'mobile' ? 'text-base' : 'text-xl'} font-bold {themeClasses.text}">{modalTitle}</h3>
              <div class="flex items-center gap-2 text-xs opacity-70 {themeClasses.text}">
                <svelte:component this={getPlatformIcon()} class="w-3 h-3" />
                <span>{platform} • {deviceType} • {operatingSystem}</span>
                {#if isLandscape && deviceType === 'mobile'}
                  <span>• landscape</span>
                {/if}
              </div>
            </div>
          </div>
          <div class="flex gap-1 {deviceType === 'mobile' ? 'gap-1' : 'gap-2'}">
            <button
              class="btn btn-ghost {deviceType === 'mobile' ? 'btn-xs' : 'btn-sm'} {themeClasses.button} rounded-xl"
              onclick={toggleTheme}
              aria-label="Toggle Theme"
            >
              {#if currentTheme === 'dark'}
                <Sun class="w-4 h-4" />
              {:else}
                <Moon class="w-4 h-4" />
              {/if}
            </button>
            {#if scanMode === 'camera'}
              {#if availableCameras.length > 1}
                <button
                  class="btn btn-ghost {deviceType === 'mobile' ? 'btn-xs' : 'btn-sm'} {themeClasses.button} rounded-xl"
                  onclick={switchCamera}
                  aria-label="Switch Camera"
                >
                  <Camera class="w-4 h-4" />
                </button>
              {/if}
              <button
                class="btn btn-ghost {deviceType === 'mobile' ? 'btn-xs' : 'btn-sm'} {themeClasses.button} rounded-xl"
                onclick={flipCamera}
                aria-label="Flip Camera"
              >
                <RotateCcw class="w-4 h-4" />
              </button>
              {#if hasFlashlight}
                <button
                  class="btn btn-ghost {deviceType === 'mobile' ? 'btn-xs' : 'btn-sm'} {themeClasses.button} rounded-xl {isFlashlightOn ? 'text-warning bg-warning/20' : ''}"
                  onclick={toggleFlashlight}
                  aria-label="Toggle Flashlight"
                >
                  <Flashlight class="w-4 h-4" />
                </button>
              {/if}
            {/if}
            <button
              class="btn btn-ghost {deviceType === 'mobile' ? 'btn-xs' : 'btn-sm'} {themeClasses.button} rounded-xl hover:bg-error/20"
              onclick={() => toggleModal(false)}
              aria-label="Close QR Scanner"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {#if allowImageUpload}
        <div class="p-3 {deviceType === 'mobile' ? 'p-2' : 'p-4'}">
          <div class="bg-base-200/30 backdrop-blur-lg rounded-2xl p-1 flex border border-base-content/20">
            <button
              class="flex-1 flex items-center justify-center gap-2 py-2 {deviceType === 'mobile' ? 'py-2 px-2' : 'py-3 px-4'} rounded-xl text-sm font-medium transition-all duration-300 {scanMode === 'camera' ? 'bg-primary text-primary-content shadow-lg scale-[0.98] backdrop-blur-sm' : 'hover:bg-base-content/15 ' + themeClasses.text}"
              onclick={() => switchScanMode('camera')}
            >
              <Camera class="w-4 h-4" />
              <span class="{deviceType === 'mobile' ? 'text-xs' : 'text-sm'}">Camera</span>
            </button>
            <button
              class="flex-1 flex items-center justify-center gap-2 py-2 {deviceType === 'mobile' ? 'py-2 px-2' : 'py-3 px-4'} rounded-xl text-sm font-medium transition-all duration-300 {scanMode === 'image' ? 'bg-secondary text-secondary-content shadow-lg scale-[0.98] backdrop-blur-sm' : 'hover:bg-base-content/15 ' + themeClasses.text}"
              onclick={() => switchScanMode('image')}
            >
              <ImageIcon class="w-4 h-4" />
              <span class="{deviceType === 'mobile' ? 'text-xs' : 'text-sm'}">Upload</span>
            </button>
          </div>
        </div>
      {/if}

      <div class="p-3 {deviceType === 'mobile' ? 'p-2' : 'p-4'}">
        <div class="relative w-full {deviceType === 'mobile' && isLandscape ? 'aspect-[16/9]' : 'aspect-square'} {themeClasses.card} rounded-2xl overflow-hidden shadow-inner border-2 border-transparent bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 bg-clip-border">
          <div class="absolute inset-[2px] rounded-2xl bg-base-100/10 backdrop-blur-lg border border-base-content/10"></div>
          {#if scanMode === 'camera'}
            <div class="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden">
              <video bind:this={videoElement} class="w-full h-full object-cover" playsinline>
                <track kind="captions" />
              </video>
              {#if !isCameraActive && !errorMessage}
                <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                  <div class="text-white text-lg">Initializing camera...</div>
                </div>
              {/if}
              {#if errorMessage}
                <div class="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 p-4">
                  <div class="text-white text-center mb-4">{errorMessage}</div>
                  <button class="btn btn-sm btn-primary" onclick={retryScanner}>
                    Request Permission Again
                  </button>
                </div>
              {/if}
            </div>
            {#if !isCameraActive && !errorMessage}
              <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-br from-base-200/90 to-base-300/90 backdrop-blur-xl rounded-2xl border border-base-content/20">
                <div class="loading loading-spinner loading-lg text-primary mb-4"></div>
                <div class="text-lg {deviceType === 'mobile' ? 'text-base' : 'text-lg'} font-semibold {themeClasses.text} mb-2 text-center">
                  Initializing camera...
                </div>
                <div class="text-sm opacity-60 {themeClasses.text} text-center">
                  <div class="flex items-center justify-center gap-2 mb-1">
                    <svelte:component this={getPlatformIcon()} class="w-4 h-4" />
                    <span>{platform} • {operatingSystem}</span>
                  </div>
                  {#if platform === 'flatpak'}
                    <div class="text-xs">Checking portal permissions...</div>
                  {:else if platform === 'electron'}
                    <div class="text-xs">Requesting native access...</div>
                  {:else if deviceType === 'mobile'}
                    <div class="text-xs">Optimizing for mobile...</div>
                  {/if}
                </div>
              </div>
            {/if}
            {#if scanningIndicator}
              <div class="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                <div class="bg-success/95 text-success-content px-6 py-3 rounded-full shadow-xl backdrop-blur-lg animate-pulse border border-success/30">
                  <div class="flex items-center gap-2">
                    <Zap class="w-5 h-5 animate-bounce" />
                    <span class="font-medium {deviceType === 'mobile' ? 'text-sm' : 'text-base'}">Scanning...</span>
                  </div>
                </div>
              </div>
            {/if}
            {#if deviceType === 'mobile' && isCameraActive}
              <div class="absolute inset-0 z-25 pointer-events-none">
                <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-primary/60 rounded-xl">
                  <div class="absolute -top-3 -left-3 w-6 h-6 border-l-2 border-t-2 border-primary rounded-tl-lg"></div>
                  <div class="absolute -top-3 -right-3 w-6 h-6 border-r-2 border-t-2 border-primary rounded-tr-lg"></div>
                  <div class="absolute -bottom-3 -left-3 w-6 h-6 border-l-2 border-b-2 border-primary rounded-bl-lg"></div>
                  <div class="absolute -bottom-3 -right-3 w-6 h-6 border-r-2 border-b-2 border-primary rounded-br-lg"></div>
                </div>
              </div>
            {/if}
          {:else}
            <div class="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 {deviceType === 'mobile' ? 'p-3' : 'p-8'}">
              {#if uploadedImageUrl}
                <div class="relative w-full h-full flex items-center justify-center">
                  <img src={uploadedImageUrl} alt="Uploaded QR Code" class="max-w-full max-h-full object-contain rounded-xl shadow-xl border border-base-content/20" />
                  <button
                    class="absolute top-2 right-2 btn btn-circle {deviceType === 'mobile' ? 'btn-sm' : 'btn-md'} bg-error/90 hover:bg-error text-error-content border-none shadow-lg backdrop-blur-sm"
                    onclick={() => {
                      if (uploadedImageUrl) {
                        URL.revokeObjectURL(uploadedImageUrl);
                        uploadedImageUrl = null;
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              {:else}
                <div class="text-center w-full">
                  <div class="relative mb-4 {deviceType === 'mobile' ? 'mb-3' : 'mb-6'}">
                    <div class="w-16 h-16 {deviceType === 'mobile' ? 'w-12 h-12' : 'w-20 h-20'} mx-auto bg-gradient-to-br from-secondary/30 to-primary/30 rounded-full flex items-center justify-center backdrop-blur-lg border border-base-content/20 shadow-lg">
                      <Upload class="w-8 h-8 {deviceType === 'mobile' ? 'w-6 h-6' : 'w-10 h-10'} {themeClasses.accent} animate-bounce" />
                    </div>
                    <div class="absolute -top-2 -right-2 w-4 h-4 bg-primary/70 rounded-full animate-ping shadow-lg"></div>
                    <div class="absolute -bottom-1 -left-1 w-3 h-3 bg-secondary/70 rounded-full animate-ping shadow-lg" style="animation-delay: 0.5s;"></div>
                    <div class="absolute top-1/2 -right-3 w-2 h-2 bg-accent/60 rounded-full animate-ping shadow-lg" style="animation-delay: 1s;"></div>
                  </div>
                  <h4 class="text-lg {deviceType === 'mobile' ? 'text-base' : 'text-lg'} font-semibold {themeClasses.text} mb-2">Upload QR Code Image</h4>
                  <p class="text-sm {deviceType === 'mobile' ? 'text-xs' : 'text-sm'} opacity-70 {themeClasses.text} mb-4 {deviceType === 'mobile' ? 'mb-3' : 'mb-6'} leading-relaxed">
                    Select an image file containing a QR code<br />
                    Supports JPG, PNG, WebP, and other formats
                  </p>
                  <button
                    class="btn {deviceType === 'mobile' ? 'btn-md' : 'btn-lg'} bg-gradient-to-r from-primary via-secondary to-accent text-primary-content border-none rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-lg"
                    onclick={handleFileSelect}
                    disabled={isProcessingImage}
                  >
                    {#if isProcessingImage}
                      <span class="loading loading-spinner loading-sm"></span>
                      Processing...
                    {:else}
                      <Upload class="w-5 h-5" />
                      Choose Image
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          {/if}
          {#if errorMessage}
            <div class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-error/15 backdrop-blur-xl rounded-2xl border border-error/30">
              <div class="max-w-sm mx-auto text-center p-4 {deviceType === 'mobile' ? 'p-3 max-w-xs' : 'p-6'} bg-base-100/30 backdrop-blur-lg rounded-xl border border-base-content/20 shadow-xl">
                <div class="w-12 h-12 {deviceType === 'mobile' ? 'w-10 h-10' : 'w-16 h-16'} mx-auto mb-3 {deviceType === 'mobile' ? 'mb-2' : 'mb-4'} bg-error/30 rounded-full flex items-center justify-center backdrop-blur-sm border border-error/40">
                  <svg class="w-6 h-6 {deviceType === 'mobile' ? 'w-5 h-5' : 'w-8 h-8'} text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <p class="text-sm {deviceType === 'mobile' ? 'text-xs' : 'text-sm'} {themeClasses.text} mb-3 {deviceType === 'mobile' ? 'mb-2' : 'mb-4'} leading-relaxed">{errorMessage}</p>
                {#if scanMode === 'camera'}
                  <button
                    class="btn {deviceType === 'mobile' ? 'btn-sm' : 'btn-md'} bg-primary/90 hover:bg-primary text-primary-content border-none rounded-lg backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300"
                    onclick={retryScanner}
                  >
                    <RotateCcw class="w-4 h-4" />
                    Try Again
                  </button>
                {:else}
                  <button
                    class="btn {deviceType === 'mobile' ? 'btn-sm' : 'btn-md'} bg-secondary/90 hover:bg-secondary text-secondary-content border-none rounded-lg backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300"
                    onclick={handleFileSelect}
                  >
                    <Upload class="w-4 h-4" />
                    Choose Different Image
                  </button>
                {/if}
              </div>
            </div>
          {/if}
          {#if isProcessingImage}
            <div class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-base-200/90 backdrop-blur-xl rounded-2xl border border-base-content/20">
              <div class="loading loading-spinner loading-lg text-secondary mb-4"></div>
              <div class="text-lg {deviceType === 'mobile' ? 'text-base' : 'text-lg'} font-semibold {themeClasses.text} mb-2">Processing image...</div>
              <div class="text-sm opacity-60 {themeClasses.text}">Scanning for QR codes</div>
            </div>
          {/if}
        </div>
      </div>

      <div class="p-3 {deviceType === 'mobile' ? 'p-2' : 'p-4'}">
        <div class="{themeClasses.card} rounded-2xl p-3 {deviceType === 'mobile' ? 'p-2' : 'p-4'} border border-base-content/20">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 {deviceType === 'mobile' ? 'w-6 h-6' : 'w-8 h-8'} bg-info/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 backdrop-blur-sm border border-info/40">
              <svg class="w-4 h-4 {deviceType === 'mobile' ? 'w-3 h-3' : 'w-4 h-4'} text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="flex-1">
              <p class="text-sm {deviceType === 'mobile' ? 'text-xs' : 'text-sm'} {themeClasses.text} leading-relaxed">
                {#if scanMode === 'camera'}
                  Position QR codes within the camera frame. Optimized for {platform} on {operatingSystem}.
                  {#if hasFlashlight}
                    <br />Use flashlight for low light.
                  {/if}
                  {#if deviceType === 'mobile'}
                    <br />Best results when QR code fills the scan area.
                  {/if}
                {:else}
                  Upload images containing QR codes. Supports common formats.
                {/if}
              </p>
              {#if scanCount > 0 || nativePermissionStatus !== 'unknown'}
                <div class="mt-2 {deviceType === 'mobile' ? 'mt-1' : 'mt-3'} flex flex-wrap items-center gap-2 {deviceType === 'mobile' ? 'gap-1' : 'gap-4'} text-xs {deviceType === 'mobile' ? 'text-[10px]' : 'text-xs'} opacity-60 {themeClasses.text}">
                  {#if scanCount > 0}
                    <span class="flex items-center gap-1">
                      <Zap class="w-3 h-3" />
                      Scans: {scanCount}
                    </span>
                  {/if}
                  <span class="flex items-center gap-1">
                    <svelte:component this={getPlatformIcon()} class="w-3 h-3" />
                    {platform}
                  </span>
                  {#if scanMode === 'camera' && availableCameras.length > 0}
                    <span class="flex items-center gap-1">
                      <Camera class="w-3 h-3" />
                      {availableCameras.length} camera{availableCameras.length > 1 ? 's' : ''}
                    </span>
                  {/if}
                  {#if nativePermissionStatus !== 'unknown'}
                    <span class="flex items-center gap-1">
                      <div class="w-2 h-2 rounded-full {nativePermissionStatus === 'granted' ? 'bg-success' : nativePermissionStatus === 'denied' ? 'bg-error' : 'bg-warning'}"></div>
                      {nativePermissionStatus}
                    </span>
                  {/if}
                  {#if hasFlashlight}
                    <span class="flex items-center gap-1">
                      <Flashlight class="w-3 h-3" />
                      flash
                    </span>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <div class="p-3 {deviceType === 'mobile' ? 'p-2' : 'p-4'} border-t border-base-content/20">
        <div class="flex justify-between items-center gap-2 {deviceType === 'mobile' ? 'gap-1' : 'gap-3'}">
          <div class="flex gap-1 {deviceType === 'mobile' ? 'gap-1' : 'gap-2'}">
            {#if scanMode === 'camera' && isCameraActive && !continuousScanning}
              <button
                class="btn {deviceType === 'mobile' ? 'btn-xs' : 'btn-sm'} bg-success/90 hover:bg-success text-success-content border-none rounded-lg backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300"
                onclick={() => {
                  continuousScanning = true;
                  setupContinuousScanning();
                }}
              >
                <Zap class="w-4 h-4" />
                {#if deviceType !== 'mobile'}
                  <span>Continuous</span>
                {/if}
              </button>
            {/if}
            {#if scanMode === 'image' && !uploadedImageUrl}
              <button
                class="btn {deviceType === 'mobile' ? 'btn-xs' : 'btn-sm'} bg-secondary/90 hover:bg-secondary text-secondary-content border-none rounded-lg backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300"
                onclick={handleFileSelect}
                disabled={isProcessingImage}
              >
                {#if isProcessingImage}
                  <span class="loading loading-spinner loading-xs"></span>
                  {#if deviceType !== 'mobile'}
                    Processing...
                  {/if}
                {:else}
                  <Upload class="w-4 h-4" />
                  {#if deviceType !== 'mobile'}
                    <span>Choose</span>
                  {/if}
                {/if}
              </button>
            {/if}
            {#if (platform === 'electron' || platform === 'flatpak') && electronAPI}
              <div class="flex items-center gap-1 px-2 py-1 bg-base-content/10 rounded-lg backdrop-blur-sm text-xs {themeClasses.text}">
                <div class="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                {#if deviceType !== 'mobile'}
                  <span>Native</span>
                {/if}
              </div>
            {/if}
          </div>
          <div class="flex gap-1 {deviceType === 'mobile' ? 'gap-1' : 'gap-2'}">
            {#if !isCameraActive && errorMessage && scanMode === 'camera'}
              <button
                class="btn {deviceType === 'mobile' ? 'btn-xs' : 'btn-sm'} bg-warning/90 hover:bg-warning text-warning-content border-none rounded-lg backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300"
                onclick={retryScanner}
              >
                <RotateCcw class="w-4 h-4" />
                {#if deviceType !== 'mobile'}
                  <span>Retry</span>
                {/if}
              </button>
            {/if}
            {#if platform === 'electron' || platform === 'flatpak'}
              <button
                class="btn {deviceType === 'mobile' ? 'btn-xs' : 'btn-sm'} bg-base-content/10 hover:bg-base-content/20 {themeClasses.text} border-none rounded-lg backdrop-blur-sm opacity-70 hover:opacity-100 transition-all duration-300"
                onclick={() => console.log('Platform Info:', { platform, deviceType, operatingSystem, nativePermissionStatus, availableCameras: availableCameras.length, hasFlashlight, electronAPI: !!electronAPI, supportedConstraints })}
                title="Debug Info"
              >
                <svelte:component this={getPlatformIcon()} class="w-4 h-4" />
                {#if deviceType !== 'mobile'}
                  <span>Debug</span>
                {/if}
              </button>
            {/if}
            <button
              class="btn {deviceType === 'mobile' ? 'btn-xs' : 'btn-sm'} bg-base-content/15 hover:bg-base-content/25 {themeClasses.text} border-none rounded-lg backdrop-blur-lg transition-all duration-300"
              onclick={() => toggleModal(false)}
            >
              {#if deviceType === 'mobile'}
                ✕
              {:else}
                Cancel
              {/if}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.9) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .animate-fade-in { animation: fade-in 0.3s ease-out; }
  .animate-scale-in { animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .backdrop-blur-xs { backdrop-filter: blur(2px); }
  .backdrop-blur-2xl { backdrop-filter: blur(40px); }
  .shadow-inner { box-shadow: inset 0 2px 8px 0 rgba(0, 0, 0, 0.1); }
  .btn:hover { transform: translateY(-2px); }
  .btn:active { transform: translateY(0); }
  @media (max-width: 640px) {
    .btn-lg { @apply btn-md; }
    .modal-box { margin: 0.5rem; }
    .btn-xs { min-height: 2rem; min-width: 2rem; }
  }
  @media (max-height: 640px) and (orientation: landscape) {
    .aspect-square { aspect-ratio: 16/9; }
  }
  .flatpak-optimized { image-rendering: crisp-edges; }
  .electron-native { -webkit-app-region: no-drag; }
  .loading-spinner { animation-duration: 0.8s; }
  .scan-guide-mobile { border-width: 3px; border-style: dashed; animation: scan-pulse 2s infinite ease-in-out; }
  @keyframes scan-pulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.02); }
  }
  video { filter: contrast(1.1) brightness(1.05); }
  .native-indicator { position: relative; }
  .native-indicator::after {
    content: ''; position: absolute; top: -2px; right: -2px; width: 6px; height: 6px; background: #00ff00; border-radius: 50%; animation: native-pulse 2s infinite;
  }
  @keyframes native-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(0.9); }
  }
  @media (prefers-reduced-motion: reduce) {
    .animate-fade-in, .animate-scale-in, .animate-bounce, .animate-pulse { animation: none; }
  }
  @media (prefers-contrast: high) {
    .backdrop-blur-xl, .backdrop-blur-lg, .backdrop-blur-md {
      backdrop-filter: none; background-color: var(--fallback-b1, oklch(var(--b1)));
    }
  }
</style>
