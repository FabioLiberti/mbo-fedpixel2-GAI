import React, { useEffect, useState, useRef, useCallback } from 'react';
import './SplashScreen.css';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [videoFadeOut, setVideoFadeOut] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoAttempt, setVideoAttempt] = useState(0);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);

  // Funzione per avviare la transizione alla schermata successiva
  const startTransition = useCallback(() => {
    setVideoFadeOut(true);
    setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onComplete();
      }, 300);
    }, 500);
  }, [onComplete]);

  // Gestisce l'interazione dell'utente per attivare l'audio
  const handleUserInteraction = useCallback(() => {
    if (!videoRef.current || audioEnabled) return;

    console.log('User interaction detected, trying to enable audio');
    
    // First, ensure the video is paused
    videoRef.current.pause();
    
    // Set a small delay to ensure the video is fully paused
    setTimeout(() => {
      try {
        // Unmute the video
        videoRef.current!.muted = false;
        
        // Try to play with audio
        const playPromise = videoRef.current!.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Audio enabled successfully');
              setAudioEnabled(true);
            })
            .catch((error) => {
              console.error('Failed to enable audio:', error);
              // Don't try again immediately, let the user interact again
            });
        }
      } catch (error) {
        console.error('Error enabling audio:', error);
      }
    }, 100);
  }, [audioEnabled]);

  useEffect(() => {
    console.log('SplashScreen component mounted');
    
    // Funzione per tentare di riprodurre il video automaticamente
    const attemptAutoplay = async () => {
      if (videoRef.current) {
        try {
          // Assicurati che il video sia configurato correttamente per l'autoplay
          videoRef.current.muted = true; // I browser consentono l'autoplay muto
          videoRef.current.playsInline = true;
          videoRef.current.setAttribute('playsinline', ''); // Per iOS
          
          // Attendiamo che il video sia pronto
          await new Promise<void>((resolve) => {
            if (videoRef.current) {
              if (videoRef.current.readyState >= 3) {
                resolve();
              } else {
                videoRef.current.addEventListener('canplay', () => resolve(), { once: true });
              }
            }
          });
          
          // Ora proviamo a riprodurre il video
          console.log('Video is ready, attempting autoplay');
          await videoRef.current.play();
          console.log('Autoplay started successfully (muted)');
          setVideoStarted(true);
        } catch (error) {
          console.error('Error auto-playing muted video on mount:', error);
          
          // Se fallisce l'autoplay, mostriamo un pulsante di play esplicito
          const playButton = document.createElement('button');
          playButton.className = 'play-button';
          playButton.innerHTML = '▶';
          playButton.addEventListener('click', () => {
            if (videoRef.current) {
              videoRef.current.play().catch(err => 
                console.error('Failed to play video after explicit user action:', err)
              );
              playButton.remove();
            }
          });
          
          document.querySelector('.video-container')?.appendChild(playButton);
        }
      }
    };
    
    // Avvia l'autoplay dopo un breve ritardo per assicurarsi che tutto sia pronto
    const autoplayTimer = setTimeout(() => {
      attemptAutoplay();
    }, 100);

    // Memorizza il riferimento video attuale per il cleanup
    const videoElement = videoRef.current;

    // Ascoltatore per l'evento di completamento della splash screen Phaser
    const handleSplashComplete = () => {
      console.log('Phaser splash screen complete event received');
      startTransition();
    };
    
    // Ascoltatore per l'evento di nascondi video splash
    const handleHideVideoSplash = () => {
      console.log('Hide video splash event received');
      setVideoFadeOut(true);
    };
    
    // Aggiungi gli ascoltatori di eventi
    window.addEventListener('splashScreenComplete', handleSplashComplete);
    window.addEventListener('hideVideoSplash', handleHideVideoSplash);
    window.addEventListener('mousedown', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    
    // Pulizia
    return () => {
      console.log('SplashScreen component unmounting');
      clearTimeout(autoplayTimer);
      
      if (videoElement) {
        videoElement.pause();
      }
      
      window.removeEventListener('splashScreenComplete', handleSplashComplete);
      window.removeEventListener('hideVideoSplash', handleHideVideoSplash);
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, [handleUserInteraction, startTransition]);

  // Handler per gli errori del video
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video error:', e);
    
    // Se il primo video fallisce, prova con il secondo
    if (videoAttempt === 0 && videoRef.current) {
      console.log('Trying alternative video...');
      setVideoAttempt(1);
      
      try {
        videoRef.current.src = "assets/video/MBO-FedPixel_VideoAnimation.mp4";
        videoRef.current.load();
        videoRef.current.play().catch(err => {
          console.error('Error playing alternate video:', err);
        });
      } catch (error) {
        console.error('Error switching to alternate video:', error);
      }
    }
  };

  // Handler per la fine del video
  const handleVideoEnded = () => {
    console.log('Video ended, waiting for user interaction to continue');
    setVideoEnded(true);
    
    // Emetti un evento per informare Phaser che il video è terminato
    const videoEndedEvent = new CustomEvent('videoSplashEnded');
    window.dispatchEvent(videoEndedEvent);
    
    // Mostra un messaggio più evidente che indica all'utente di fare clic
    const clickPrompt = document.createElement('div');
    clickPrompt.className = 'click-to-continue';
    clickPrompt.textContent = 'Clicca per continuare';
    document.querySelector('.video-container')?.appendChild(clickPrompt);
    
    // Imposta un timer di fallback per la transizione automatica dopo 5 secondi
    setTimeout(() => {
      if (isVisible && !videoFadeOut) {
        console.log('Auto transition after video end timeout');
        startTransition();
      }
    }, 5000);
  };

  // Handler per il play del video
  const handleVideoPlay = () => {
    console.log('Video started playing (muted)');
    setVideoStarted(true);
    
    // Informa Phaser che il video è iniziato
    const customEvent = new CustomEvent('splashScreenReady', { detail: { playing: true } });
    window.dispatchEvent(customEvent);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className={`splash-screen ${videoFadeOut ? 'fade-out' : ''}`}
      onClick={handleUserInteraction}
    >
      <div className="video-container">
        <video 
          id="splash-video"
          ref={videoRef}
          className="splash-video"
          playsInline
          preload="auto"
          onError={handleVideoError}
          onEnded={handleVideoEnded}
          onPlay={handleVideoPlay}
        >
          <source src="assets/video/splash-intro.mp4" type="video/mp4" />
        </video>
        
        {videoStarted && !audioEnabled && !videoEnded && (
          <button 
            className="unmute-button"
            onClick={(e) => {
              e.stopPropagation();
              handleUserInteraction();
            }}
          >
            <span className="icon">🔊</span>
            <span className="text">Attiva Audio</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SplashScreen;