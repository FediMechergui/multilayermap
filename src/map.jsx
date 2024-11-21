import React, { useState, useRef, useEffect } from 'react';
import { Layers, Pen, MapPin, Move, Eye, EyeOff, Trash2, Plus, Download, Palette } from 'lucide-react';
import { 
    Slider, 
    Alert,
    Snackbar,
    IconButton,
    Tooltip,
  } from '@mui/material';

const MapEditor = () => {
    const [layers, setLayers] = useState([]);
    const [activeLayerId, setActiveLayerId] = useState(null);
    const [selectedTool, setSelectedTool] = useState('move');
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPoint, setLastPoint] = useState(null);
    const [draggedLayer, setDraggedLayer] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [hoveredPin, setHoveredPin] = useState(null);
    const [currentColor, setCurrentColor] = useState('#000000');
    const [currentOpacity, setCurrentOpacity] = useState(100);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [notification, setNotification] = useState(null);
  
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const containerRef = useRef(null);
  
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
    
        // Set canvas size to fit container while maintaining image aspect ratio
        const resizeCanvas = () => {
            const imageLayer = layers.find(l => l.type === 'image');
            if (imageLayer && imageLayer.image) {
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;
                const imageAspect = imageLayer.image.width / imageLayer.image.height;
                const containerAspect = containerWidth / containerHeight;
        
                if (imageAspect > containerAspect) {
                    canvas.width = containerWidth;
                    canvas.height = containerWidth / imageAspect;
                } else {
                    canvas.height = containerHeight;
                    canvas.width = containerHeight * imageAspect;
                }
            } else {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }
        };
    
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    
        const context = canvas.getContext('2d');
        context.lineCap = 'round';
        contextRef.current = context;
    
        drawLayers();
    
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [layers]);
  
    const generateHeatmap = (ctx, pins) => {
        const maxValue = Math.max(...pins.map(pin => parseFloat(pin.value) || 0));
        const minValue = Math.min(...pins.map(pin => parseFloat(pin.value) || 0));
        const radius = 50; // Heatmap radius
    
        // Create temporary canvas for heatmap
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = ctx.canvas.width;
        tempCanvas.height = ctx.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
    
        pins.forEach(pin => {
            const value = parseFloat(pin.value) || 0;
            const normalizedValue = (value - minValue) / (maxValue - minValue);
      
            const gradient = tempCtx.createRadialGradient(
                pin.x, pin.y, 0,
                pin.x, pin.y, radius
            );
      
            gradient.addColorStop(0, `rgba(255, 0, 0, ${normalizedValue * 0.6})`);
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      
            tempCtx.fillStyle = gradient;
            tempCtx.fillRect(pin.x - radius, pin.y - radius, radius * 2, radius * 2);
        });
    
        // Apply heatmap to main canvas
        ctx.globalAlpha = 0.7;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
    };
  
    const drawLayers = () => {
        const ctx = contextRef.current;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
        [...layers].reverse().forEach(layer => {
            if (layer.visible) {
                ctx.globalAlpha = layer.opacity / 100;
        
                if (layer.type === 'image' && layer.image) {
                    ctx.drawImage(layer.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
                } else if (layer.type === 'drawing') {
                    layer.paths.forEach(path => {
                        ctx.beginPath();
                        ctx.strokeStyle = path.color || '#000000';
                        ctx.lineWidth = 2;
                        ctx.moveTo(path[0].x, path[0].y);
                        path.forEach(point => {
                            ctx.lineTo(point.x, point.y);
                        });
                        ctx.stroke();
                    });
                } else if (layer.type === 'pins') {
                    layer.pins.forEach(pin => {
                        ctx.beginPath();
                        ctx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
                        ctx.fillStyle = 'red';
                        ctx.fill();
                        ctx.stroke();
            
                        if (hoveredPin === pin || !showHeatmap) {
                            ctx.fillStyle = 'black';
                            ctx.font = '12px Arial';
                            ctx.fillText(pin.value, pin.x + 10, pin.y + 4);
                        }
                    });
          
                    if (showHeatmap && layer.pins.length > 0) {
                        generateHeatmap(ctx, layer.pins);
                    }
                }
            }
        });
    };

    const addLayer = (type) => {
        const newLayer = {
            id: Date.now(),
            type,
            visible: true,
            opacity: 100,
            x: 0,
            y: 0,
            paths: [],
            pins: [],
        };
        setLayers([newLayer, ...layers]);
        setActiveLayerId(newLayer.id);
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const newLayer = {
                    id: Date.now(),
                    type: 'image',
                    image: img,
                    visible: true,
                    opacity: 100,
                    x: 0,
                    y: 0
                };
                setLayers([newLayer, ...layers]);
                setActiveLayerId(newLayer.id);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    const exportCanvas = () => {
        const link = document.createElement('a');
        link.download = 'map-export.png';
        link.href = canvasRef.current.toDataURL();
        link.click();
    };

    const handleDragStart = (e, layerId) => {
        setDraggedLayer(layerId);
    };

    const handleDragOver = (e, targetId) => {
        e.preventDefault();
        setDropTarget(targetId);
    };

    const handleDrop = (e, targetId) => {
        e.preventDefault();
        if (draggedLayer === targetId) return;

        const draggedIndex = layers.findIndex(l => l.id === draggedLayer);
        const targetIndex = layers.findIndex(l => l.id === targetId);
    
        const newLayers = [...layers];
        const [removed] = newLayers.splice(draggedIndex, 1);
        newLayers.splice(targetIndex, 0, removed);
    
        setLayers(newLayers);
        setDraggedLayer(null);
        setDropTarget(null);
    };

    const toggleLayerVisibility = (layerId) => {
        setLayers(layers.map(layer =>
            layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
        ));
    };

    const deleteLayer = (layerId) => {
        setLayers(layers.filter(layer => layer.id !== layerId));
        if (activeLayerId === layerId) {
            setActiveLayerId(null);
        }
    };

    const handleMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
    
        if (selectedTool === 'draw') {
            setIsDrawing(true);
            setLastPoint({ x, y });
            const activeLayer = layers.find(l => l.id === activeLayerId);
            if (activeLayer) {
                const updatedLayers = layers.map(layer =>
                    layer.id === activeLayerId
                        ? { ...layer, paths: [...layer.paths, [{ x, y }]] }
                        : layer
                );
                setLayers(updatedLayers);
            }
        } else if (selectedTool === 'pin') {
            const value = prompt('Enter pin value:');
            if (value) {
                const updatedLayers = layers.map(layer =>
                    layer.id === activeLayerId
                        ? {
                            ...layer,
                            type: 'pins',
                            pins: [...(layer.pins || []), { x, y, value }]
                        }
                        : layer
                );
                setLayers(updatedLayers);
            }
        }
    };

    const handleMouseMove = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
  
        // Handle drawing
        if (isDrawing && selectedTool === 'draw') {
            setLayers(layers.map(layer => {
                if (layer.id === activeLayerId) {
                    const currentPath = layer.paths[layer.paths.length - 1];
                    return {
                        ...layer,
                        paths: [
                            ...layer.paths.slice(0, -1),
                            [...currentPath, { x, y, color: currentColor }]
                        ]
                    };
                }
                return layer;
            }));
            setLastPoint({ x, y });
        }
  
        // Handle pin hovering - check all pin layers, not just active
        const pinsLayer = layers.find(l => l.type === 'pins');
        if (pinsLayer) {
            const hoveredPin = pinsLayer.pins.find(pin =>
                Math.hypot(pin.x - x, pin.y - y) < 10
            );
            setHoveredPin(hoveredPin);
        } else {
            setHoveredPin(null);
        }
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
        setLastPoint(null);
    };

    return (
        <div className="flex h-screen">
            {/* Left Sidebar */}
            <div className="w-72 bg-gray-100 p-4 flex flex-col">
                {/* Tools Section */}
                <div className="mb-4">
                    <h2 className="text-lg font-bold mb-2">Tools</h2>
                    <div className="flex gap-2 mb-4">
                        <button
                            className={`p-2 rounded transition-colors ${selectedTool === 'move' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            onClick={() => setSelectedTool('move')}
                            title="Move Tool"
                        >
                            <Move className="w-6 h-6" />
                        </button>
                        <button
                            className={`p-2 rounded transition-colors ${selectedTool === 'draw' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            onClick={() => setSelectedTool('draw')}
                            title="Draw Tool"
                        >
                            <Pen className="w-6 h-6" />
                        </button>
                        <button
                            className={`p-2 rounded transition-colors ${selectedTool === 'pin' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                            onClick={() => setSelectedTool('pin')}
                            title="Pin Tool"
                        >
                            <MapPin className="w-6 h-6" />
                        </button>
                    </div>
  
                    {/* Color Picker (shows only when draw tool is selected) */}
                    {selectedTool === 'draw' && (
                        <div className="mb-4 p-3 bg-white rounded shadow-sm">
                            <label className="block text-sm font-medium mb-2">Drawing Color</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={currentColor}
                                    onChange={(e) => setCurrentColor(e.target.value)}
                                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                                />
                                <span className="text-sm text-gray-600">{currentColor}</span>
                            </div>
                        </div>
                    )}
                </div>
  
                {/* Layer Settings with MUI Components */}
                <div className="mb-4">
                    <h2 className="text-lg font-bold mb-2">Layer Settings</h2>
                    {activeLayerId && (
                        <div className="p-3 bg-white rounded shadow-sm">
                            <label className="block text-sm font-medium mb-2">Layer Opacity</label>
                            <Slider
                                value={currentOpacity}
                                onChange={(_, value) => {
                                    setCurrentOpacity(value);
                                    setLayers(layers.map(layer =>
                                        layer.id === activeLayerId
                                            ? { ...layer, opacity: value }
                                            : layer
                                    ));
                                }}
                                min={0}
                                max={100}
                                valueLabelDisplay="auto"
                                sx={{
                                    '& .MuiSlider-thumb': {
                                        backgroundColor: '#1976d2',
                                    },
                                    '& .MuiSlider-track': {
                                        backgroundColor: '#1976d2',
                                    },
                                    '& .MuiSlider-rail': {
                                        backgroundColor: '#bfbfbf',
                                    },
                                }}
                            />
                        </div>
                    )}

                    {/* Heatmap Toggle with MUI Tooltip */}
                    {layers.some(l => l.type === 'pins') && (
                        <div className="mt-3 p-3 bg-white rounded shadow-sm">
                            <Tooltip title="Toggle heatmap visualization" placement="right">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showHeatmap}
                                        onChange={(e) => setShowHeatmap(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium">Show Heatmap</span>
                                </label>
                            </Tooltip>
                        </div>
                    )}
                </div>

                {/* Layer Management with MUI Tooltips */}
                <div className="flex-1 overflow-y-auto">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-lg font-bold">Layers</h2>
                        <div className="flex gap-2">
                            <Tooltip title="Add drawing layer">
                                <button
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                                    onClick={() => addLayer('drawing')}
                                >
                                    <Plus className="w-4 h-4" /> Drawing
                                </button>
                            </Tooltip>
                            <Tooltip title="Upload image layer">
                                <label className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm cursor-pointer">
                                    <Plus className="w-4 h-4" /> Image
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                </label>
                            </Tooltip>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {layers.map((layer, index) => (
                            <div
                                key={layer.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, layer.id)}
                                onDragOver={(e) => handleDragOver(e, layer.id)}
                                onDrop={(e) => handleDrop(e, layer.id)}
                                className={`
                flex items-center justify-between p-2 rounded
                ${activeLayerId === layer.id ? 'bg-blue-100' : 'bg-white'}
                ${draggedLayer === layer.id ? 'opacity-50' : ''}
                ${dropTarget === layer.id ? 'border-2 border-blue-500' : 'border border-gray-200'}
                cursor-move hover:border-blue-300 transition-colors
              `}
                                onClick={() => setActiveLayerId(layer.id)}
                            >
                                <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm">
                                        {layer.type.charAt(0).toUpperCase() + layer.type.slice(1)} {index + 1}
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <Tooltip title={layer.visible ? "Hide Layer" : "Show Layer"}>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleLayerVisibility(layer.id);
                                            }}
                                        >
                                            {layer.visible ?
                                                <Eye className="w-4 h-4 text-gray-600" /> :
                                                <EyeOff className="w-4 h-4 text-gray-400" />
                                            }
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Layer">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteLayer(layer.id);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </IconButton>
                                    </Tooltip>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Export Button with MUI Tooltip */}
                <Tooltip title="Save canvas as PNG">
                    <button
                        className="mt-4 px-4 py-2 bg-green-500 text-white rounded flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
                        onClick={exportCanvas}
                    >
                        <Download className="w-4 h-4" /> Export Image
                    </button>
                </Tooltip>
            </div>

            {/* Canvas Container */}
            <div ref={containerRef} className="flex-1 overflow-hidden bg-gray-50">
                <canvas
                    ref={canvasRef}
                    className="border-l"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />
            </div>

            {/* MUI Snackbar for notifications */}
            <Snackbar
                open={Boolean(notification)}
                autoHideDuration={6000}
            >
                <Alert
                    onClose={() => setNotification(null)}
                    severity={notification?.severity || 'info'}
                    sx={{ width: '100%' }}
                >
                    {notification?.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

export default MapEditor;