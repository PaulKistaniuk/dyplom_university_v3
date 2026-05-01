"use client";

import { useAuth } from "@/shared/hooks/useAuth";
import { useEffect, useRef, useState } from "react";

export default function MediaSettingsPage() {
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }>({ cameras: [], mics: [] });
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");

  // Enumerate available devices
  const enumerateDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const cameras = allDevices.filter(d => d.kind === "videoinput");
      const mics = allDevices.filter(d => d.kind === "audioinput");
      setDevices({ cameras, mics });

      if (cameras.length > 0 && !selectedCamera) setSelectedCamera(cameras[0].deviceId);
      if (mics.length > 0 && !selectedMic) setSelectedMic(mics[0].deviceId);
    } catch (err) {
      console.error("Failed to enumerate devices:", err);
    }
  };

  // Start or restart stream with current settings
  const startStream = async (enableVideo: boolean, enableAudio: boolean) => {
    // Stop existing stream
    stopStream();

    if (!enableVideo && !enableAudio) return;

    try {
      const constraints: MediaStreamConstraints = {};

      if (enableVideo) {
        constraints.video = selectedCamera ? { deviceId: { exact: selectedCamera } } : true;
      }
      if (enableAudio) {
        constraints.audio = selectedMic ? { deviceId: { exact: selectedMic } } : true;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (enableVideo && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      if (enableAudio) {
        startAudioAnalyser(stream);
      }

      // Re-enumerate to get labels (after permission granted)
      await enumerateDevices();

      setError(null);
    } catch (err: any) {
      console.error("getUserMedia error:", err);
      if (err.name === "NotAllowedError") {
        setError("Доступ до камери/мікрофону заблоковано. Перевірте дозволи у браузері.");
      } else if (err.name === "NotFoundError") {
        setError("Камеру або мікрофон не знайдено.");
      } else {
        setError("Помилка при доступі до медіа-пристроїв.");
      }
      setCameraOn(false);
      setMicOn(false);
    }
  };

  // Stop all tracks
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    analyserRef.current = null;
    setMicLevel(0);
  };

  // Audio analyser for mic level visualization
  const startAudioAnalyser = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalized = Math.min(avg / 128, 1); // normalize to 0-1
      setMicLevel(normalized);

      animationRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  };

  // Toggle camera
  const toggleCamera = async () => {
    const newState = !cameraOn;
    setCameraOn(newState);

    if (newState) {
      await startStream(true, micOn);
    } else {
      // Only stop video tracks
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        // If mic is still on, keep audio tracks
        if (!micOn) {
          stopStream();
        }
      }
    }
  };

  // Toggle mic
  const toggleMic = async () => {
    const newState = !micOn;
    setMicOn(newState);

    if (newState) {
      await startStream(cameraOn, true);
    } else {
      // Only stop audio tracks
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => track.stop());
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        analyserRef.current = null;
        setMicLevel(0);
        // If camera is still on, keep video tracks
        if (!cameraOn) {
          stopStream();
        }
      }
    }
  };

  // Handle device change
  const handleCameraChange = async (deviceId: string) => {
    setSelectedCamera(deviceId);
    if (cameraOn) {
      await startStream(true, micOn);
    }
  };

  const handleMicChange = async (deviceId: string) => {
    setSelectedMic(deviceId);
    if (micOn) {
      await startStream(cameraOn, true);
    }
  };

  // Init: enumerate devices
  useEffect(() => {
    enumerateDevices();
    return () => {
      stopStream();
    };
  }, []);

  // Restart stream when device selection changes
  useEffect(() => {
    if (cameraOn || micOn) {
      startStream(cameraOn, micOn);
    }
  }, [selectedCamera, selectedMic]);

  const btnBase = {
    padding: "0.75rem 1.5rem",
    borderRadius: "50px",
    border: "none",
    cursor: "pointer",
    fontWeight: "bold" as const,
    fontSize: "1rem",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem"
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem", color: "#38bdf8" }}>
        Налаштування зв'язку
      </h1>

      {error && (
        <div style={{
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          color: "#ef4444",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1.5rem",
          border: "1px solid rgba(239, 68, 68, 0.2)"
        }}>
          {error}
        </div>
      )}

      {/* Video Preview */}
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: "640px",
        aspectRatio: "16/9",
        backgroundColor: "#1e293b",
        borderRadius: "16px",
        overflow: "hidden",
        border: "2px solid #334155",
        marginBottom: "1.5rem"
      }}>
        {cameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
          />
        ) : (
          <div style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "1rem"
          }}>
            <img
              src={user?.avatarUrl || "/default_user.png"}
              alt="Avatar"
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid #38bdf8"
              }}
            />
            <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Камера вимкнена</span>
          </div>
        )}

        {/* Mic level indicator overlay */}
        {micOn && (
          <div style={{
            position: "absolute",
            bottom: "12px",
            left: "12px",
            display: "flex",
            alignItems: "flex-end",
            gap: "3px",
            height: "24px"
          }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                width: "4px",
                height: `${4 + i * 4}px`,
                borderRadius: "2px",
                backgroundColor: micLevel > (i * 0.2) ? "#22c55e" : "#475569",
                transition: "background-color 0.1s"
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <button
          onClick={toggleMic}
          style={{
            ...btnBase,
            backgroundColor: micOn ? "#1e293b" : "#dc2626",
            color: "#f8fafc",
            border: micOn ? "2px solid #334155" : "2px solid #dc2626"
          }}
        >
          <span style={{ fontSize: "1.25rem" }}>{micOn ? "🎙️" : "🔇"}</span>
          {micOn ? "Мікрофон увімк." : "Мікрофон вимк."}
        </button>

        <button
          onClick={toggleCamera}
          style={{
            ...btnBase,
            backgroundColor: cameraOn ? "#1e293b" : "#dc2626",
            color: "#f8fafc",
            border: cameraOn ? "2px solid #334155" : "2px solid #dc2626"
          }}
        >
          <span style={{ fontSize: "1.25rem" }}>{cameraOn ? "📹" : "📷"}</span>
          {cameraOn ? "Камера увімк." : "Камера вимк."}
        </button>
      </div>

      {/* Mic Level Bar */}
      {micOn && (
        <div style={{ marginBottom: "2rem", maxWidth: "640px" }}>
          <div style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "0.5rem" }}>Рівень мікрофону</div>
          <div style={{
            width: "100%",
            height: "8px",
            backgroundColor: "#1e293b",
            borderRadius: "4px",
            overflow: "hidden",
            border: "1px solid #334155"
          }}>
            <div style={{
              width: `${micLevel * 100}%`,
              height: "100%",
              backgroundColor: micLevel > 0.7 ? "#ef4444" : micLevel > 0.4 ? "#eab308" : "#22c55e",
              borderRadius: "4px",
              transition: "width 0.05s, background-color 0.2s"
            }} />
          </div>
        </div>
      )}

      {/* Device Selection */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "640px" }}>
        {/* Camera Select */}
        <div style={{
          backgroundColor: "#1e293b",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid #334155"
        }}>
          <div style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Камера</div>
          <select
            value={selectedCamera}
            onChange={(e) => handleCameraChange(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              backgroundColor: "#334155",
              border: "1px solid #475569",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "0.875rem"
            }}
          >
            {devices.cameras.length === 0 && <option value="">Камеру не знайдено</option>}
            {devices.cameras.map(cam => (
              <option key={cam.deviceId} value={cam.deviceId}>
                {cam.label || `Камера ${cam.deviceId.slice(0, 8)}...`}
              </option>
            ))}
          </select>
        </div>

        {/* Mic Select */}
        <div style={{
          backgroundColor: "#1e293b",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid #334155"
        }}>
          <div style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Мікрофон</div>
          <select
            value={selectedMic}
            onChange={(e) => handleMicChange(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              backgroundColor: "#334155",
              border: "1px solid #475569",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "0.875rem"
            }}
          >
            {devices.mics.length === 0 && <option value="">Мікрофон не знайдено</option>}
            {devices.mics.map(mic => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label || `Мікрофон ${mic.deviceId.slice(0, 8)}...`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
