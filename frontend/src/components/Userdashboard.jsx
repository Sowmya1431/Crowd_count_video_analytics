import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Video, Square, Check, X, Play, Pause, Maximize2, Trash2, Edit3, BarChart3, Eye, Plus, AlertCircle, User, LogOut, ChevronDown } from 'lucide-react';
import './UserDashboard.css';
import { useNavigate } from 'react-router-dom';
import AnalyticsModal from './AnalyticsModal';

const UserDashboard = () => {
  const navigate = useNavigate();
  const [feeds, setFeeds] = useState([]);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [zones, setZones] = useState([]);
  const [detections, setDetections] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [feedNameInput, setFeedNameInput] = useState('');
  const [summary, setSummary] = useState(null);
  const [liveCount, setLiveCount] = useState(0);
  const [isWebcam, setIsWebcam] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState([]);
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [zoneNameInput, setZoneNameInput] = useState('');
  const [videoSrc, setVideoSrc] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [heatmapPolygon, setHeatmapPolygon] = useState(null);
  const [activeTab, setActiveTab] = useState('draw');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [error, setError] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState(null);
  const [cropCurrent, setCropCurrent] = useState(null);
  const [detectionBoxes, setDetectionBoxes] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [processingStatus, setProcessingStatus] = useState(null); // 'processing', 'completed', 'failed'
  const [notifications, setNotifications] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ message: '', onConfirm: null });

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const videoRef = useRef(null);
  const previewContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_BASE = 'http://127.0.0.1:5000/api/feeds';
  const token = typeof window !== 'undefined' ? localStorage?.getItem('token') : null;

  const getHeaders = () => ({
    'Authorization': `Bearer ${token}`
  });

  const showNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const showError = (message) => {
    showNotification(message, 'error');
  };

  const showSuccess = (message) => {
    showNotification(message, 'success');
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmConfig({ message, onConfirm });
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    if (confirmConfig.onConfirm) {
      confirmConfig.onConfirm();
    }
    setShowConfirmDialog(false);
    setConfirmConfig({ message: '', onConfirm: null });
  };

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
    setConfirmConfig({ message: '', onConfirm: null });
  };

  const handleLogout = () => {
    showConfirm('Are you sure you want to logout?', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('userEmail');
      navigate('/');
    });
  };

  // Poll processing status
  const pollProcessingStatus = async (feedId) => {
    let attempts = 0;
    const maxAttempts = 60; // Poll for max 5 minutes (60 * 5 seconds)
    
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/${feedId}`, {
          headers: getHeaders()
        });
        
        if (res.ok) {
          const data = await res.json();
          const feed = data.feed;
          
          if (feed.processing_status === 'completed') {
            setProcessingStatus(null);
            showSuccess('Video processing completed successfully!');
            // Reload feed to get updated detections
            if (selectedFeed === feedId) {
              await handleSelectFeed(feedId);
            }
            return;
          } else if (feed.processing_status === 'failed') {
            setProcessingStatus(null);
            showError('Video processing failed');
            return;
          }
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setProcessingStatus('completed'); // Assume completed after timeout
          setTimeout(() => setProcessingStatus(null), 3000);
        }
      } catch (err) {
        console.error('Error polling processing status:', err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        }
      }
    };
    
    poll();
  };

  // Get user email from localStorage
  useEffect(() => {
    const email = localStorage.getItem('userEmail') || localStorage.getItem('email') || 'user@example.com';
    setUserEmail(email);
  }, []);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showProfileMenu && !e.target.closest('.ud-profile-dropdown')) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const loadFeeds = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE, {
        headers: getHeaders()
      });
      
      if (!res.ok) throw new Error('Failed to load feeds');
      
      const data = await res.json();
      setFeeds(data.feeds || []);
    } catch (err) {
      console.error('Error loading feeds', err);
      showError('Failed to load feeds. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeeds();
    return () => {
      if (videoSrc && videoSrc.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc);
      }
      if (webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleVideoFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      showError('Please upload a valid video file (MP4, AVI, MOV, MKV, WEBM)');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      showError('File size too large. Maximum 500MB allowed.');
      return;
    }
    
    setVideoFile(file);
    setFeedNameInput(file.name.replace(/\.[^/.]+$/, ''));
    setShowUploadModal(true);
  };

  const handleVideoUpload = async () => {
    if (!videoFile) return;
    if (!feedNameInput.trim()) {
      showError('Please enter a feed name');
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    setShowUploadModal(false);

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('feed_name', feedNameInput.trim());

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      xhr.open('POST', `${API_BASE}/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.onload = async () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          setUploading(false);
          setUploadProgress(0);
          
          showSuccess('Video uploaded successfully!');
          
          // Show processing status if video is being processed
          if (data.processing_status === 'processing') {
            setProcessingStatus('processing');
          }
          
          await loadFeeds();
          try { 
            await handleSelectFeed(data.feed_id); 
          } catch(e) {
            console.error(e);
          }
          
          setVideoFile(null);
          setFeedNameInput('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          
          // Poll for processing completion
          if (data.processing_status === 'processing') {
            pollProcessingStatus(data.feed_id);
          }
        } else {
          const error = JSON.parse(xhr.responseText);
          showError(error.error || 'Upload failed!');
          setUploading(false);
          setUploadProgress(0);
        }
      };

      xhr.onerror = () => {
        showError('Upload failed! Network error.');
        setUploading(false);
        setUploadProgress(0);
      };

      xhr.send(formData);
    } catch (err) {
      console.error(err);
      showError('Upload failed!');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSelectFeed = async (feedId) => {
    setSelectedFeed(feedId);
    setSummary(null);
    setZones([]);
    setPreviewImage(null);
    setVideoSrc(null);
    setPolygon([]);
    setEditingZoneId(null);
    setDrawing(false);
    setAnalysis(null);
    setLoading(true);
    
    if (isWebcam) {
      stopWebcam();
    }

    try {
      const [zoneRes, feedRes] = await Promise.all([
        fetch(`${API_BASE}/${feedId}/zones`, { headers: getHeaders() }),
        fetch(`${API_BASE}/${feedId}`, { headers: getHeaders() })
      ]);
      
      const zoneData = await zoneRes.json();
      setZones(zoneData.zones || []);

      const feedData = await feedRes.json();
      const feed = feedData.feed;
      
      if (feed) {
        setSummary(feed.summary);
        
        if (feed._id) {
          // Set video source with token as query parameter
          const videoUrl = `${API_BASE}/video/${feed._id}?token=${token}`;
          setVideoSrc(videoUrl);
          
          // Load video in video element
          if (videoRef.current) {
            videoRef.current.src = videoUrl;
            videoRef.current.load();
          }

          try {
            const detRes = await fetch(`${API_BASE}/${feed._id}/detections`, { 
              headers: getHeaders() 
            });
            if (detRes.ok) {
              const detData = await detRes.json();
              setDetections(detData.detections || []);
            }
          } catch (e) {
            console.error('Could not load detections', e);
          }
        }
      }
    } catch (err) {
      console.error(err);
      showError('Could not load feed data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFeed = async (feedId, feedName) => {
    showConfirm(`Are you sure you want to delete "${feedName}"? This action cannot be undone.`, async () => {
      try {
        const res = await fetch(`${API_BASE}/${feedId}`, {
          method: 'DELETE',
          headers: getHeaders()
        });

        if (!res.ok) {
          throw new Error('Failed to delete feed');
        }

        showSuccess(`Feed "${feedName}" deleted successfully`);
        
        // If the deleted feed was selected, clear selection
      if (selectedFeed === feedId) {
        setSelectedFeed(null);
        setVideoSrc(null);
        setPreviewImage(null);
        setZones([]);
        setPolygon([]);
        setSummary(null);
        setAnalysis(null);
      }

        // Reload feeds list
        await loadFeeds();
        
      } catch (err) {
        console.error('Error deleting feed:', err);
        showError('Failed to delete feed. Please try again.');
      }
    });
  };

  const startWebcam = async () => {
    try {
      // Request higher quality webcam stream for better detection
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        }, 
        audio: false 
      });
      setIsWebcam(true);
      setWebcamStream(stream);
      setSelectedFeed('webcam');
      setVideoSrc(null);
      setPreviewImage(null);
      setZones([]);
      setPolygon([]);
      setSummary(null);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(()=>{});
      }
    } catch (err) {
      console.error('Webcam error', err);
      showError('Could not access webcam. Check permissions.');
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(t => t.stop());
    }
    setWebcamStream(null);
    setIsWebcam(false);
    setLiveCount(0);
    
    if (videoRef.current) {
      try { 
        videoRef.current.pause(); 
        videoRef.current.srcObject = null; 
      } catch(e){}
    }
    setSelectedFeed(null);
  };

  const analyzeWebcamFrame = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Ensure video is ready and has valid dimensions
    if (!video.videoWidth || !video.videoHeight) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      // Higher quality JPEG for better detection accuracy (0.9 instead of 0.5)
      canvas.toBlob(async (blob) => {
        if (!blob) return resolve(null);
        const fd = new FormData();
        fd.append('frame', blob, 'frame.jpg');
        
        // Send all zone polygons to backend for server-side filtering
        if (zones && zones.length > 0) {
          const zonePolygons = zones.map(z => z.polygon).filter(p => p && p.length >= 3);
          if (zonePolygons.length > 0) {
            fd.append('zones', JSON.stringify(zonePolygons));
          }
        }

        try {
          const res = await fetch(`${API_BASE}/analyze_frame`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: fd
          });
          
          if (!res.ok) {
            console.error('analyze_frame response not ok:', res.status);
            return resolve(null);
          }
          
          const data = await res.json();
          if (data && data.boxes) {
            // Backend already filtered boxes by zones, use them directly
            const filteredBoxes = data.boxes || [];
            
            setLiveCount(filteredBoxes.length);
            setDetectionBoxes(filteredBoxes);
            resolve(data);
          } else {
            resolve(null);
          }
        } catch (e) {
          console.error('analyze_frame error', e);
          resolve(null);
        }
      }, 'image/jpeg', 0.9);
    });
  };

  useEffect(() => {
    if (!isWebcam) return;
    let id = null;
    let isProcessing = false;
    
    const loop = async () => {
      if (!isProcessing) {
        isProcessing = true;
        await analyzeWebcamFrame();
        isProcessing = false;
      }
      // Faster detection: 300ms instead of 700ms
      id = setTimeout(loop, 300);
    };
    loop();
    return () => { if (id) clearTimeout(id); };
  }, [isWebcam, zones]);

  const handlePreviewZones = async () => {
    // Preview tab now shows video with zones overlay - no need to load static image
    if (!selectedFeed || selectedFeed === 'webcam') {
      showError('Preview not available for webcam');
      return;
    }
    
    // Just ensure video is playing
    if (videoRef.current && videoRef.current.paused) {
      try {
        await videoRef.current.play();
      } catch (e) {
        console.log('Video autoplay prevented', e);
      }
    }
  };

  const handleToggleFullscreen = async () => {
    const el = previewContainerRef.current;
    if (!el) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) el.msRequestFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen API error', e);
    }
  };

  const handleCanvasMouseDown = (e) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    setIsCropping(true);
    setCropStart({ x, y });
    setCropCurrent({ x, y });
    setPolygon([]);
  };

  const handleCanvasMouseMove = (e) => {
    if (!drawing || !isCropping || !cropStart) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    setCropCurrent({ x, y });
  };

  const handleCanvasMouseUp = () => {
    if (!drawing || !isCropping || !cropStart || !cropCurrent) return;
    
    const x1 = Math.min(cropStart.x, cropCurrent.x);
    const y1 = Math.min(cropStart.y, cropCurrent.y);
    const x2 = Math.max(cropStart.x, cropCurrent.x);
    const y2 = Math.max(cropStart.y, cropCurrent.y);
    
    if (Math.abs(x2 - x1) < 10 || Math.abs(y2 - y1) < 10) {
      showError('Zone too small. Please draw a larger area.');
      setIsCropping(false);
      setCropStart(null);
      setCropCurrent(null);
      return;
    }
    
    const newPolygon = [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2]
    ];
    
    setPolygon(newPolygon);
    setIsCropping(false);
    setCropStart(null);
    setCropCurrent(null);
  };

  const handleFinishZone = async () => {
    if (!selectedFeed) {
      showError('Select a feed first');
      return;
    }
    if (polygon.length < 3) {
      showError('Draw a zone first!');
      return;
    }
    if (!zoneNameInput.trim()) {
      showError('Enter zone name');
      return;
    }

    setLoading(true);
    try {
      const body = {
        zone_name: zoneNameInput.trim(),
        polygon
      };
      
      if (selectedFeed === 'webcam') {
        if (editingZoneId) {
          setZones(prev => prev.map(z => 
            z.zone_id === editingZoneId 
              ? { ...z, zone_name: zoneNameInput.trim(), polygon } 
              : z
          ));
        } else {
          const newZone = { 
            zone_id: `local_${Date.now()}`, 
            zone_name: zoneNameInput.trim(), 
            polygon, 
            created_at: new Date().toISOString() 
          };
          setZones(prev => [newZone, ...prev]);
        }
        
        setPolygon([]);
        setZoneNameInput('');
        setDrawing(false);
        setEditingZoneId(null);
        setActiveTab('update');
      } else {
        let res;
        if (editingZoneId) {
          res = await fetch(`${API_BASE}/${selectedFeed}/zones/${editingZoneId}`, {
            method: 'PUT',
            headers: {
              ...getHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });
        } else {
          res = await fetch(`${API_BASE}/${selectedFeed}/zones`, {
            method: 'POST',
            headers: {
              ...getHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });
        }

        const data = await res.json();
        
        if (res.ok) {
          const zoneRes = await fetch(`${API_BASE}/${selectedFeed}/zones`, {
            headers: getHeaders()
          });
          const zoneData = await zoneRes.json();
          setZones(zoneData.zones || []);
          
          showSuccess(editingZoneId ? 'Zone updated successfully!' : 'Zone created successfully!');
          
          setPolygon([]);
          setZoneNameInput('');
          setDrawing(false);
          setEditingZoneId(null);
          setActiveTab('update');
        } else {
          showError(data.error || 'Error saving zone');
        }
      }
    } catch (err) {
      console.error(err);
      showError('Error saving zone');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteZone = async (zoneId) => {
    showConfirm('Are you sure you want to delete this zone?', async () => {
      setLoading(true);
      try {
        if (selectedFeed === 'webcam') {
          setZones(prev => prev.filter(z => z.zone_id !== zoneId));
          if (editingZoneId === zoneId) {
            setEditingZoneId(null);
            setPolygon([]);
          }
          showSuccess('Zone deleted successfully');
        } else {
          const res = await fetch(`${API_BASE}/${selectedFeed}/zones/${zoneId}`, {
            method: 'DELETE',
          headers: getHeaders()
        });
      
          if (res.ok) {
            setZones(prev => prev.filter(z => z.zone_id !== zoneId));
            if (editingZoneId === zoneId) {
              setEditingZoneId(null);
              setPolygon([]);
            }
            showSuccess('Zone deleted successfully');
          } else {
            const data = await res.json();
            showError(data.error || 'Error deleting zone');
          }
        }
      } catch (err) {
        console.error(err);
        showError('Error deleting zone');
      } finally {
        setLoading(false);
      }
    });
  };

  const startEditZone = (zone) => {
    setEditingZoneId(zone.zone_id);
    setPolygon(zone.polygon || []);
    setZoneNameInput(zone.zone_name || '');
    setDrawing(true);
    setActiveTab('draw');
    
    // Show a message to user
    showError(`Editing zone: ${zone.zone_name}. Draw a new rectangle to update.`);
    setTimeout(() => setError(null), 3000);
  };

  const handleAnalyzeZone = async (zoneId) => {
    if (selectedFeed === 'webcam') {
      showError('Cannot analyze webcam zones (live only)');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${selectedFeed}/analyze_zone`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zone_id: zoneId,
          frame_step: 1
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setAnalysis(data.analysis);
        setActiveTab('analysis');
      } else {
        showError(data.error || 'Zone analysis failed!');
      }
    } catch (err) {
      console.error(err);
      showError('Zone analysis failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeAllZones = async () => {
    if (!zones.length) {
      showError('No zones to analyze');
      return;
    }

    if (selectedFeed === 'webcam') {
      showError('Cannot analyze webcam zones');
      return;
    }

    setLoading(true);
    try {
      const results = [];
      for (const z of zones) {
        try {
          const r = await fetch(`${API_BASE}/${selectedFeed}/analyze_zone`, {
            method: 'POST',
            headers: {
              ...getHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ zone_id: z.zone_id, frame_step: 1 })
          });

          if (!r.ok) {
            let errBody = null;
            try { errBody = await r.json(); } catch (e) {}
            results.push({ zone: z.zone_id, ok: false, error: (errBody && errBody.error) || `HTTP ${r.status}` });
            continue;
          }

          const body = await r.json();
          results.push({ zone: z.zone_id, ok: true, analysis: body.analysis });
        } catch (e) {
          results.push({ zone: z.zone_id, ok: false, error: e.message });
        }
      }

      const successCount = results.filter(r => r.ok).length;
      
      const zoneRes = await fetch(`${API_BASE}/${selectedFeed}/zones`, {
        headers: getHeaders()
      });
      const zoneData = await zoneRes.json();
      setZones(zoneData.zones || []);
      
      // Calculate combined totals from all zones
      if (successCount > 0) {
        const successfulResults = results.filter(r => r.ok && r.analysis);
        
        // For total persons passed, take the MAXIMUM (not sum) to avoid counting same person in multiple zones
        let maxPersonsPassed = 0;
        let totalPeakOccupancy = 0;
        let totalAvgCount = 0;
        
        successfulResults.forEach(r => {
          maxPersonsPassed = Math.max(maxPersonsPassed, r.analysis.total_persons_passed || 0);
          totalPeakOccupancy += (r.analysis.peak_count || 0);
          totalAvgCount += (r.analysis.avg_count || 0);
        });
        
        const avgCountAcrossZones = successfulResults.length > 0 ? totalAvgCount / successfulResults.length : 0;
        
        // Build combined time-series (timestamps + counts_per_frame) by aligning per-zone samples
        let combinedTimestamps = [];
        let combinedCounts = [];

        if (successfulResults.length > 0) {
          // Prefer using the first successful result as timebase if it has timestamps
          const base = successfulResults[0].analysis || {};
          const baseTimestamps = Array.isArray(base.timestamps) && base.timestamps.length ? base.timestamps : [];

          if (baseTimestamps.length) {
            combinedTimestamps = baseTimestamps.slice();
            combinedCounts = new Array(combinedTimestamps.length).fill(0);

            successfulResults.forEach(r => {
              const a = r.analysis || {};
              const counts = Array.isArray(a.counts_per_frame) ? a.counts_per_frame : [];

              if (counts.length === combinedCounts.length) {
                for (let i = 0; i < counts.length; i++) combinedCounts[i] += (counts[i] || 0);
              } else if (Array.isArray(a.timestamps) && a.timestamps.length) {
                // map by timestamp string
                const map = {};
                a.timestamps.forEach((t, idx) => { map[String(t)] = (a.counts_per_frame && a.counts_per_frame[idx]) || 0; });
                for (let i = 0; i < combinedTimestamps.length; i++) combinedCounts[i] += (map[String(combinedTimestamps[i])] || 0);
              } else if (counts.length > 0) {
                // fallback: approximate mapping by index
                for (let i = 0; i < combinedCounts.length; i++) {
                  const idx = Math.floor(i * (counts.length / combinedCounts.length));
                  combinedCounts[i] += (counts[idx] || 0);
                }
              }
            });
          } else {
            // No timestamps available: try to use frames_analyzed or counts length as base
            const n = (base.frames_analyzed && Number(base.frames_analyzed)) || (Array.isArray(base.counts_per_frame) ? base.counts_per_frame.length : 0);
            combinedCounts = new Array(n).fill(0);

            successfulResults.forEach(r => {
              const a = r.analysis || {};
              const counts = Array.isArray(a.counts_per_frame) ? a.counts_per_frame : [];
              if (counts.length === combinedCounts.length) {
                for (let i = 0; i < counts.length; i++) combinedCounts[i] += (counts[i] || 0);
              } else if (counts.length > 0) {
                for (let i = 0; i < combinedCounts.length; i++) {
                  const idx = Math.floor(i * (counts.length / combinedCounts.length));
                  combinedCounts[i] += (counts[idx] || 0);
                }
              }
            });
          }
        }

        // Show combined analysis
        setAnalysis({
          zone_name: `All Zones Combined (${successCount} zones)`,
          total_persons_passed: maxPersonsPassed,
          peak_count: totalPeakOccupancy,
          avg_count: avgCountAcrossZones,
          frames_analyzed: combinedCounts.length || (successfulResults.length > 0 ? successfulResults[0].analysis.frames_analyzed : 0),
          fps: successfulResults.length > 0 ? successfulResults[0].analysis.fps : 0,
          duration: successfulResults.length > 0 ? successfulResults[0].analysis.duration : 0,
          peak_time: successfulResults.length > 0 ? successfulResults[0].analysis.peak_time : 0,
          counts_per_frame: combinedCounts,
          timestamps: combinedTimestamps
        });
      }
      
      if (successCount === zones.length) {
        showSuccess(`Successfully analyzed all ${successCount} zones`);
      } else if (successCount > 0) {
        showNotification(`Analyzed ${successCount}/${zones.length} zones`, 'warning');
      } else {
        showError('Failed to analyze zones');
      }
    } catch (err) {
      console.error(err);
      showError('Bulk analysis failed!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw zones
    zones.forEach(zone => {
      const pts = zone.polygon || [];
      if (!pts.length) return;
      
      // Count detections in this zone
      const detectionsInZone = detectionBoxes.filter(box => {
        const [x1, y1, x2, y2] = box;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        return isPointInPolygon([centerX, centerY], pts);
      }).length;
      
      // Use different styling based on whether zone has detections
      const hasDetections = detectionsInZone > 0;
      ctx.strokeStyle = hasDetections ? '#ef4444' : '#10b981';
      ctx.lineWidth = hasDetections ? 4 : 3;
      ctx.fillStyle = hasDetections ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)';
      
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      
      if (zone.zone_name) {
        const label = `${zone.zone_name}${hasDetections ? ` (${detectionsInZone})` : ''}`;
        ctx.font = 'bold 16px system-ui';
        const metrics = ctx.measureText(label);
        const textWidth = metrics.width;
        const textHeight = 20;
        
        const x = pts[0][0];
        const y = pts[0][1];
        
        ctx.fillStyle = hasDetections ? '#ef4444' : '#10b981';
        ctx.fillRect(x - 4, y - textHeight - 4, textWidth + 8, textHeight + 8);
        
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, y - 4);
      }
    });

    // Draw current polygon being edited
    if (polygon.length > 0) {
      ctx.beginPath();
      ctx.moveTo(polygon[0][0], polygon[0][1]);
      polygon.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fill();

      polygon.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Draw YOLO detections (only those inside zones)
    detectionBoxes.forEach(([x1, y1, x2, y2]) => {
      const isInZone = isBoxInAnyZone([x1, y1, x2, y2]);
      
      // Use different color for boxes inside vs outside zones
      if (isInZone || zones.length === 0) {
        ctx.strokeStyle = '#ef4444'; // Red for detected persons in zones
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      } else {
        ctx.strokeStyle = '#94a3b8'; // Gray for persons outside zones
        ctx.fillStyle = 'rgba(148, 163, 184, 0.05)';
      }
      
      ctx.lineWidth = 2;
      const width = x2 - x1;
      const height = y2 - y1;
      ctx.strokeRect(x1, y1, width, height);
      ctx.fillRect(x1, y1, width, height);
      
      // Draw label
      ctx.fillStyle = isInZone || zones.length === 0 ? '#ef4444' : '#94a3b8';
      ctx.font = 'bold 12px system-ui';
      ctx.fillText(isInZone || zones.length === 0 ? 'Person' : 'Outside', x1 + 2, y1 - 2);
    });

    // Draw crop preview
    if (isCropping && cropStart && cropCurrent) {
      const x1 = Math.min(cropStart.x, cropCurrent.x);
      const y1 = Math.min(cropStart.y, cropCurrent.y);
      const x2 = Math.max(cropStart.x, cropCurrent.x);
      const y2 = Math.max(cropStart.y, cropCurrent.y);
      
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      
      [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      
      const width = x2 - x1;
      const height = y2 - y1;
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 14px system-ui';
      ctx.fillText(`${width} x ${height}`, x1 + 5, y1 - 5);
    }
  }, [zones, polygon, isCropping, cropStart, cropCurrent, detectionBoxes]);

  // Helper function to check if a point is inside a polygon
  const isPointInPolygon = (point, polygon) => {
    if (!polygon || polygon.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      
      const intersect = ((yi > point[1]) !== (yj > point[1]))
        && (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Helper function to check if box center is in any zone
  const isBoxInAnyZone = (box) => {
    if (zones.length === 0) return true; // If no zones, count all
    
    const [x1, y1, x2, y2] = box;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    
    return zones.some(zone => {
      if (!zone.polygon || zone.polygon.length < 3) return false;
      return isPointInPolygon([centerX, centerY], zone.polygon);
    });
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !detections || detections.length === 0 || isWebcam) return;

    let lastIdx = 0;
    let animationFrameId = null;
    
    const updateDetections = () => {
      if (!video || video.paused) return;
      
      const t = video.currentTime || 0;
      
      // Find closest detection frame
      let closestIdx = lastIdx;
      let minDiff = Math.abs(detections[lastIdx]?.timestamp - t);
      
      for (let i = Math.max(0, lastIdx - 5); i < Math.min(detections.length, lastIdx + 10); i++) {
        const diff = Math.abs(detections[i].timestamp - t);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      
      if (closestIdx < detections.length) {
        lastIdx = closestIdx;
        const allBoxes = detections[closestIdx].boxes || [];
        
        // Filter boxes to only those inside zones
        const boxesInZones = zones.length > 0 
          ? allBoxes.filter(box => isBoxInAnyZone(box))
          : allBoxes;
        
        setLiveCount(boxesInZones.length);
        setDetectionBoxes(boxesInZones);
      }
      
      // Continue updating at ~30fps for smooth detection display
      animationFrameId = requestAnimationFrame(updateDetections);
    };
    
    const onPlay = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(updateDetections);
    };
    
    const onPause = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };
    
    const onSeeked = () => {
      // Reset on seek to find closest frame
      lastIdx = 0;
      updateDetections();
      if (!video.paused) {
        onPlay();
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    
    // Initial update
    if (!video.paused) {
      onPlay();
    } else {
      updateDetections();
    }
    
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [detections, isWebcam, zones]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const img = imgRef.current;
    if (!canvas) return;

    const setCanvasSize = (w, h) => {
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
    };

    if (video && (videoSrc || isWebcam)) {
      const onMeta = () => setCanvasSize(video.videoWidth || 640, video.videoHeight || 360);
      video.addEventListener('loadedmetadata', onMeta);
      if (video.videoWidth && video.videoHeight) onMeta();
      return () => video.removeEventListener('loadedmetadata', onMeta);
    }

    if (img && previewImage) {
      const onLoad = () => setCanvasSize(img.naturalWidth, img.naturalHeight);
      img.addEventListener('load', onLoad);
      if (img.complete) onLoad();
      return () => img.removeEventListener('load', onLoad);
    }

    setCanvasSize(640, 360);
  }, [videoSrc, previewImage, isWebcam]);

  const selectedFeedObj = feeds.find(f => f._id === selectedFeed);
  return (
    <div className="ud-container">
      <header className="ud-header">
        <div className="ud-header-inner">
          <div className="ud-title-row">
            <div className="ud-title-left">
              <div>
                <h1 className="ud-title">Crowd Count Analysis</h1>
              </div>
            </div>
            <div className="ud-header-actions">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="ud-btn ud-btn-primary"
              >
                <Upload className="ud-btn-icon" />
                Upload Video
              </button>
              <button
                onClick={() => { if (isWebcam) stopWebcam(); else startWebcam(); }}
                className={`ud-btn ${isWebcam ? 'ud-btn-stop' : 'ud-btn-start'}`}
              >
                <Video className="ud-btn-icon" />
                {isWebcam ? 'Stop Webcam' : 'Start Webcam'}
              </button>
              
              {/* Profile Dropdown */}
              <div className="ud-profile-dropdown" style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="ud-btn ud-btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    borderRadius: '6px'
                  }}
                >
                  <User size={18} strokeWidth={2} />
                </button>
                
                {showProfileMenu && (
                  <div 
                    className="ud-profile-menu"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.75rem',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.75rem',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                      minWidth: '220px',
                      zIndex: 1000,
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Signed in as
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>
                        {userEmail}
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.875rem 1rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#ef4444',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#7f1d1d';
                        e.currentTarget.style.color = '#fecaca';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoFileSelect}
        style={{ display: 'none' }}
      />

      {showUploadModal && (
        <div className="ud-modal-overlay">
          <div className="ud-modal">
            <h3 className="ud-modal-title">Upload Video Feed</h3>
            <div className="ud-modal-body">
              <div className="ud-field">
                <label className="ud-label">Feed Name *</label>
                <input
                  type="text"
                  value={feedNameInput}
                  onChange={(e) => setFeedNameInput(e.target.value)}
                  placeholder="e.g., Main Entrance, Lobby Camera"
                  className="ud-input"
                  autoFocus
                />
              </div>
              <div className="ud-fileinfo">
                <p><strong>File:</strong> {videoFile?.name}</p>
                <p><strong>Size:</strong> {(videoFile?.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              <div className="ud-modal-actions">
                <button
                  onClick={handleVideoUpload}
                  disabled={!feedNameInput.trim()}
                  className="ud-btn ud-btn-primary ud-btn-block"
                >
                  Upload & Analyze
                </button>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setVideoFile(null);
                    setFeedNameInput('');
                  }}
                  className="ud-btn ud-btn-secondary ud-btn-block"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {uploading && (
        <div className="ud-upload-toast">
          <div className="ud-upload-row">
            <Upload className="ud-upload-icon" />
            <span className="ud-upload-text">Uploading Video...</span>
          </div>
          <div className="ud-progress">
            <div className="ud-progress-bar" style={{ width: `${uploadProgress}%` }} />
          </div>
          <div className="ud-upload-percent">{uploadProgress}%</div>
        </div>
      )}

      {processingStatus === 'processing' && (
        <div className="ud-upload-toast" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <div className="ud-upload-row">
            <Video className="ud-upload-icon" style={{ animation: 'pulse 2s infinite' }} />
            <span className="ud-upload-text">Processing video detections...</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginTop: '0.5rem' }}>
            This may take a few moments. You can use other features while processing.
          </div>
        </div>
      )}

      {processingStatus === 'completed' && (
        <div className="ud-upload-toast" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
          <div className="ud-upload-row">
            <Check className="ud-upload-icon" />
            <span className="ud-upload-text">Processing completed!</span>
          </div>
        </div>
      )}

      {error && (
        <div className="ud-error-toast">
          <div className="ud-error-row">
            <AlertCircle className="ud-error-icon" />
            <div className="ud-error-message">{error}</div>
            <button onClick={() => setError(null)} className="ud-error-close"><X className="ud-icon-small" /></button>
          </div>
        </div>
      )}

      {/* Notification Toast Container */}
      <div className="ud-notification-container">
        {notifications.map(notification => (
          <div key={notification.id} className={`ud-notification ud-notification-${notification.type}`}>
            <div className="ud-notification-content">
              {notification.type === 'success' && <Check className="ud-notification-icon" />}
              {notification.type === 'error' && <AlertCircle className="ud-notification-icon" />}
              {notification.type === 'warning' && <AlertCircle className="ud-notification-icon" />}
              {notification.type === 'info' && <AlertCircle className="ud-notification-icon" />}
              <span className="ud-notification-message">{notification.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="ud-confirm-overlay" onClick={handleCancelConfirm}>
          <div className="ud-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ud-confirm-header">
              <AlertCircle className="ud-confirm-icon" />
              <h3>Confirm Action</h3>
            </div>
            <div className="ud-confirm-body">
              <p>{confirmConfig.message}</p>
            </div>
            <div className="ud-confirm-footer">
              <button onClick={handleCancelConfirm} className="ud-btn ud-btn-secondary">Cancel</button>
              <button onClick={handleConfirm} className="ud-btn ud-btn-danger">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <div className="ud-main">
        <aside className="ud-sidebar">
          <div className="ud-sidebar-inner">
            <h2 className="ud-sidebar-title">Video Feeds</h2>
            <div className="ud-feed-list">
              <button
                onClick={startWebcam}
                className={`ud-feed-btn ${selectedFeed === 'webcam' ? 'ud-selected' : ''}`}
              >
                <div className="ud-feed-btn-inner">
                  <div className={`ud-avatar ${isWebcam ? 'ud-avatar-active' : ''}`}>
                    <Camera className={`ud-avatar-icon ${isWebcam ? 'ud-avatar-icon-active' : ''}`} />
                  </div>
                  <div className="ud-feed-info">
                    <div className="ud-feed-name">Live Webcam</div>
                    <div className="ud-feed-sub">{isWebcam ? '🔴 Active' : 'Click to start'}</div>
                  </div>
                </div>
              </button>

              {loading && feeds.length === 0 ? (
                <div className="ud-loading-feeds">Loading feeds...</div>
              ) : feeds.length === 0 ? (
                <div className="ud-loading-feeds">
                  <Upload className="ud-upload-icon-large" />
                  <p>No feeds yet</p>
                  <p className="ud-small">Upload a video to get started</p>
                </div>
              ) : (
                feeds.map(feed => (
                  <div key={feed._id} className="ud-feed-item-wrapper">
                    <button
                      onClick={() => handleSelectFeed(feed._id)}
                      className={`ud-feed-btn ${selectedFeed === feed._id ? 'ud-selected' : ''}`}
                    >
                      <div className="ud-feed-btn-inner">
                        <div className="ud-avatar ud-avatar-feed">
                          <Video className="ud-avatar-icon" />
                        </div>
                        <div className="ud-feed-info">
                          <div className="ud-feed-name">{feed.feed_name || feed.filename}</div>
                          <div className="ud-feed-sub">{feed.zone_count || 0} zones • {feed.summary?.duration?.toFixed(0)}s</div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFeed(feed._id, feed.feed_name || feed.filename);
                      }}
                      className="ud-feed-delete-btn"
                      title="Delete feed"
                    >
                      <Trash2 className="ud-icon-small" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <main className="ud-content">
          <div className="ud-content-inner">
              <div className="ud-feed-header">
                <div className="ud-feed-header-row">
                  {isWebcam && (
                    <div className="ud-live-pill">Live</div>
                  )}
                </div>
              </div>

              <div className="ud-tabs">
                {[
                  { id: 'draw', label: 'Draw Zones', icon: Square },
                  { id: 'preview', label: 'Preview', icon: Eye },
                  { id: 'update', label: 'Manage Zones', icon: Edit3 },
                  { id: 'analysis', label: 'Analysis', icon: BarChart3 }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        if (tab.id === 'preview') handlePreviewZones();
                      }}
                      className={`ud-tab ${activeTab === tab.id ? 'ud-tab-active' : ''}`}
                    >
                      <Icon className="ud-icon-small" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="ud-grid">
                <div className="ud-preview-col">
                  <div className="ud-preview-panel">
                    <div className="ud-preview-header">
                      <h3 className="ud-preview-title">Video Preview</h3>
                      <div className="ud-preview-controls">
                        <div className="ud-live-count">
                          {zones.length > 0 ? 'Zone Count: ' : 'Live Count: '}{liveCount}
                          {zones.length > 0 && <span style={{ fontSize: '0.7rem', marginLeft: '0.5rem', opacity: 0.7 }}>({zones.length} zone{zones.length !== 1 ? 's' : ''})</span>}
                        </div>
                        <button onClick={handleToggleFullscreen} className="ud-icon-btn" title="Toggle fullscreen">
                          <Maximize2 className="ud-icon-small" />
                        </button>
                      </div>
                    </div>

                    <div ref={previewContainerRef} className="ud-preview-area">
                      {isWebcam ? (
                        // Show webcam feed
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="ud-media"
                        />
                      ) : videoSrc && selectedFeed && selectedFeed !== 'webcam' ? (
                        // Show uploaded video with controls (always visible)
                        <video
                          ref={videoRef}
                          src={videoSrc}
                          controls
                          controlsList="nodownload"
                          className="ud-media"
                          style={{ width: '100%', maxHeight: '600px' }}
                          onError={(e) => {
                            console.error('Video load error:', e);
                            showError('Failed to load video. Please try again.');
                          }}
                        />
                      ) : (
                        // Show empty state
                        <div className="ud-no-preview">
                          <div className="ud-no-preview-inner">
                            <Video className="ud-no-preview-icon" />
                            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                              No Video Found
                            </p>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                              Please select a feed or upload a video to get started
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <canvas
                        ref={canvasRef}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={() => {
                          if (isCropping) {
                            setIsCropping(false);
                            setCropStart(null);
                            setCropCurrent(null);
                          }
                        }}
                        className={`ud-canvas ${drawing ? 'ud-drawing' : ''}`}
                        style={{ pointerEvents: drawing ? 'auto' : 'none' }}
                      />
                    </div>

                    {activeTab === 'draw' && (
                      <div className="ud-draw-controls">
                        {!drawing ? (
                          <div className="ud-draw-actions">
                            <button
                              onClick={() => {
                                setPolygon([]);
                                setEditingZoneId(null);
                                setZoneNameInput('');
                                setDrawing(true);
                              }}
                              className="ud-btn ud-btn-primary ud-btn-block"
                            >
                              <Square />
                              Start Drawing Zone
                            </button>
                            <button
                              onClick={() => {
                                setActiveTab('preview');
                                handlePreviewZones();
                              }}
                              disabled={selectedFeed === 'webcam'}
                              className="ud-btn ud-btn-secondary"
                              title="Preview zones on frame"
                            >
                              <Eye />
                              Preview Zones
                            </button>
                          </div>
                        ) : (
                          <div className="ud-draw-form">
                            <input
                              type="text"
                              placeholder="Enter zone name (e.g., Entrance, Queue Area)"
                              value={zoneNameInput}
                              onChange={e => setZoneNameInput(e.target.value)}
                              className="ud-input"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && polygon.length >= 3 && zoneNameInput.trim()) {
                                  handleFinishZone();
                                }
                              }}
                            />
                            <div className="ud-action-row">
                              <button
                                onClick={handleFinishZone}
                                disabled={polygon.length < 3 || !zoneNameInput.trim()}
                                className="ud-btn ud-btn-success ud-btn-block"
                              >
                                <Check />
                                {editingZoneId ? 'Update Zone' : 'Save Zone'}
                              </button>
                              <button
                                onClick={() => setPolygon([])}
                                disabled={polygon.length === 0}
                                className="ud-btn ud-btn-warning"
                              >
                                Clear
                              </button>
                              <button
                                onClick={() => {
                                  setPolygon([]);
                                  setDrawing(false);
                                  setEditingZoneId(null);
                                  setZoneNameInput('');
                                }}
                                className="ud-btn ud-btn-secondary"
                              >
                                <X />
                              </button>
                            </div>
                            <p className="ud-help">Click and drag on the video to draw a rectangular zone</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="ud-right-col">
                  {activeTab === 'update' && (
                    <div className="ud-zonemgmt">
                      <div className="ud-zonemgmt-header">
                        <h3>Zone Management</h3>
                        {zones.length > 0 && selectedFeed !== 'webcam' && (
                          <button onClick={handleAnalyzeAllZones} disabled={loading} className="ud-btn ud-btn-primary-small">Analyze All</button>
                        )}
                      </div>
                      <div className="ud-zonemgmt-body">
                        {zones.length === 0 ? (
                          <div className="ud-empty-zones">
                            <Square />
                            <p>No zones defined</p>
                            <p className="ud-help-small">Draw a zone to get started</p>
                          </div>
                        ) : (
                          <div className="ud-zone-list">
                            {zones.map(zone => (
                              <div key={zone.zone_id} className="ud-zone">
                                <div className="ud-zone-top">
                                  <div>
                                    <div className="ud-zone-name">{zone.zone_name}</div>
                                    <div className="ud-zone-id">{zone.zone_id}</div>
                                  </div>
                                </div>
                                {zone.last_analysis && (
                                  <div className="ud-zone-stats">
                                    <div>Avg: <span className="ud-stat">{zone.last_analysis.avg_count?.toFixed(1)}</span></div>
                                    <div>Peak: <span className="ud-stat ud-stat-peak">{zone.last_analysis.peak_count}</span></div>
                                  </div>
                                )}
                                <div className="ud-zone-actions">
                                  <button onClick={() => startEditZone(zone)} className="ud-btn ud-btn-muted">Edit</button>
                                  {selectedFeed !== 'webcam' && <button onClick={() => handleAnalyzeZone(zone.zone_id)} className="ud-btn ud-btn-light">Analyze</button>}
                                  <button onClick={() => handleDeleteZone(zone.zone_id)} className="ud-btn ud-btn-danger">Delete</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'analysis' && (
                    <>
                      {analysis && (
                        <div className="ud-analysis-overlay" onClick={() => setAnalysis(null)}>
                          <div className="ud-analysis" onClick={(e) => e.stopPropagation()}>
                            <div className="ud-analysis-header">
                              <h3>Analysis Results</h3>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  onClick={() => setShowAnalyticsModal(true)}
                                  className="ud-btn ud-btn-secondary"
                                  title="Open analytics plots"
                                >
                                  Analytics
                                </button>
                                <button onClick={() => setAnalysis(null)} className="ud-icon-btn"><X /></button>
                              </div>
                            </div>
                            <div className="ud-analysis-body">
                              <div className="ud-analysis-title">{analysis.zone_name}</div>
                              <div className="ud-analysis-grid">
                                <div className="ud-card"><div className="ud-card-label">Average Count</div><div className="ud-card-val">{analysis.avg_count?.toFixed(1)}</div></div>
                                <div className="ud-card ud-card-highlight"><div className="ud-card-label">Peak Occupancy</div><div className="ud-card-val">{analysis.peak_count}</div></div>
                                <div className="ud-card ud-card-info" style={{ gridColumn: 'span 2' }}>
                                  <div className="ud-card-label">Total Persons Passed</div>
                                  <div className="ud-card-val" style={{ fontSize: '2rem' }}>{analysis.total_persons_passed || 0}</div>
                                  <p style={{ 
                                    fontSize: '0.75rem', 
                                    color: 'var(--text-muted)', 
                                    marginTop: '0.5rem',
                                    fontStyle: 'italic'
                                  }}>
                                    Unique individuals tracked through zone
                                  </p>
                                </div>
                              </div>
                              <div className="ud-analysis-meta">
                                <div><span className="ud-meta-label">Peak Time</span><span className="ud-meta-val">{analysis.peak_time?.toFixed(2)}s</span></div>
                                <div><span className="ud-meta-label">Duration</span><span className="ud-meta-val">{analysis.duration?.toFixed(2)}s</span></div>
                                <div><span className="ud-meta-label">Frames Analyzed</span><span className="ud-meta-val">{analysis.frames_analyzed}</span></div>
                                <div><span className="ud-meta-label">FPS</span><span className="ud-meta-val">{analysis.fps?.toFixed(1)}</span></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {zones.length > 0 && (
                        <div className="ud-zonemgmt">
                          <div className="ud-zonemgmt-header" style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0 }}>All Zones Overview</h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {selectedFeed !== 'webcam' && (
                                <>
                                  <button onClick={handleAnalyzeAllZones} disabled={loading} className="ud-btn ud-btn-primary-small">
                                    <BarChart3 className="ud-btn-icon" style={{ width: '14px', height: '14px' }} />
                                    Analyze All
                                  </button>
                                  {/* View Analytics button removed per request */}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="ud-zonemgmt-body">
                            <div className="ud-zone-list">
                              {zones.map(zone => (
                                <div key={zone.zone_id} className="ud-zone">
                                  <div className="ud-zone-top">
                                    <div>
                                      <div className="ud-zone-name">{zone.zone_name}</div>
                                      <div className="ud-zone-id">ID: {zone.zone_id.slice(-8)}</div>
                                    </div>
                                  </div>
                                  {zone.last_analysis ? (
                                    <>
                                      <div className="ud-zone-stats">
                                        <div>Avg: <span className="ud-stat">{zone.last_analysis.avg_count?.toFixed(1)}</span></div>
                                        <div>Peak: <span className="ud-stat ud-stat-peak">{zone.last_analysis.peak_count}</span></div>
                                        <div>Total: <span className="ud-stat">{zone.last_analysis.total_persons_passed || zone.last_analysis.total_count}</span></div>
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.5rem' }}>
                                        Last analyzed: {zone.last_analysis.analyzed_at ? new Date(zone.last_analysis.analyzed_at).toLocaleString() : 'N/A'}
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                      Not analyzed yet
                                    </div>
                                  )}
                                  {selectedFeed !== 'webcam' && (
                                      <div className="ud-zone-actions" style={{ marginTop: '0.75rem', display: 'flex', gap: '8px' }}>
                                        <button 
                                          onClick={() => handleAnalyzeZone(zone.zone_id)} 
                                          className="ud-btn ud-btn-light"
                                          style={{ flex: 1 }}
                                        >
                                          <BarChart3 style={{ width: '14px', height: '14px' }} />
                                          Analyze
                                        </button>
                                                {zone.last_analysis && (
                                                  <button
                                                    onClick={() => {
                                                      setAnalysis(zone.last_analysis);
                                                      setHeatmapPolygon(zone.polygon || null);
                                                      setShowAnalyticsModal(true);
                                                      setActiveTab('analysis');
                                                    }}
                                                    className="ud-btn ud-btn-secondary"
                                                    style={{ whiteSpace: 'nowrap' }}
                                                  >
                                                    View Plots
                                                  </button>
                                                )}
                                      </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  
                </div>
              </div>
            </div>
          </main>
      </div>

      {showAnalyticsModal && (
        <AnalyticsModal
          isOpen={showAnalyticsModal}
          onClose={() => { setShowAnalyticsModal(false); setHeatmapPolygon(null); }}
          analysis={analysis}
          detections={detections}
          polygon={heatmapPolygon}
          videoRef={videoRef}
          previewUrl={selectedFeed ? `${API_BASE}/${selectedFeed}/preview` : null}
        />
      )}

      {loading && (
        <div className="ud-loading-overlay">
          <div className="ud-loading-card">
            <div className="ud-spinner" />
            <p className="ud-spinner-text">Processing...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;