// 创建Vue应用
const { createApp } = Vue;

createApp({
    data() {
            return {
                // 工具相关
                currentTool: 'pen',
                penColor: '#ff0000ff',
                penSize: 5,
                
                // 绘图状态
                isDrawing: false,
                lastX: 0,
                lastY: 0,
                
                // 画布变换
                scale: 1,
                offsetX: 0,
                offsetY: 0,
                isPanning: false,
                panStartX: 0,
                panStartY: 0,
                
                // 摄像头相关
                isCameraActive: false,
                isCameraFrozen: false,
                cameraStream: null,
                cameraStyle: {
                    transform: 'translate(0, 0) scale(1)'
                },
                previousTool: null,
                
                // 叠加画布事件监听器
                overlayEventListeners: []
            };
        },
    
    mounted() {
        // 初始化画布
        this.initCanvas();
        
        // 添加键盘事件监听器
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        
        // 初始化叠加画布
        this.initOverlayCanvas();
    },
    
    beforeUnmount() {
        // 清理事件监听器
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        
        // 关闭摄像头
        if (this.cameraStream) {
            const tracks = this.cameraStream.getTracks();
            tracks.forEach(track => track.stop());
        }
    },
    
    // 添加观察器来监视变换属性的变化
    watch: {
        scale() {
            this.applyTransform();
        },
        offsetX() {
            this.applyTransform();
        },
        offsetY() {
            this.applyTransform();
        }
    },
    
    methods: {
        // 初始化画布
        initCanvas() {
            const canvas = this.$refs.mainCanvas;
            const ctx = canvas.getContext('2d');
            
            // 设置画布实际大小
            canvas.width = 4000;
            canvas.height = 4000;
            
            // 设置初始样式
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.lineWidth = this.penSize;
            ctx.strokeStyle = this.penColor;
            
            // 填充白色背景
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        },
        
        // 初始化叠加画布
        initOverlayCanvas() {
            // 注意：叠加画布的初始化将在摄像头激活时进行
        },
        
        // 初始化叠加画布内容
        initOverlayContent() {
            if (!this.isCameraActive || !this.$refs.overlayCanvas) return;
            
            const canvas = this.$refs.overlayCanvas;
            const ctx = canvas.getContext('2d');
            
            // 设置画布实际大小
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            
            // 设置初始样式
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.lineWidth = this.penSize;
            ctx.strokeStyle = this.penColor;
            
            // 设置透明背景（不绘制任何背景）
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        },
        
        // 附加叠加画布事件
        attachOverlayEvents() {
            if (!this.isCameraActive || !this.$refs.overlayCanvas) return;
            
            const overlayCanvas = this.$refs.overlayCanvas;
            
            // 移除之前可能添加的事件监听器
            if (this.overlayEventListeners) {
                this.overlayEventListeners.forEach(({ event, handler }) => {
                    overlayCanvas.removeEventListener(event, handler);
                });
            }
            
            // 创建新的事件监听器数组
            this.overlayEventListeners = [];
            
            // 定义事件处理函数
            const handleMouseDown = (e) => {
                this.startDrawingOverlay(e);
            };
            
            const handleMouseMove = (e) => {
                this.drawOnOverlay(e);
            };
            
            const handleMouseUp = (e) => {
                this.stopDrawingOverlay(e);
            };
            
            const handleMouseLeave = (e) => {
                this.stopDrawingOverlay(e);
            };
            
            const handleWheel = (e) => {
                this.handleZoom(e);
            };
            
            // 添加事件监听器
            overlayCanvas.addEventListener('mousedown', handleMouseDown);
            overlayCanvas.addEventListener('mousemove', handleMouseMove);
            overlayCanvas.addEventListener('mouseup', handleMouseUp);
            overlayCanvas.addEventListener('mouseleave', handleMouseLeave);
            overlayCanvas.addEventListener('wheel', handleWheel);
            
            // 保存事件监听器以便后续清理
            this.overlayEventListeners.push(
                { event: 'mousedown', handler: handleMouseDown },
                { event: 'mousemove', handler: handleMouseMove },
                { event: 'mouseup', handler: handleMouseUp },
                { event: 'mouseleave', handler: handleMouseLeave },
                { event: 'wheel', handler: handleWheel }
            );
        },
        
        // 应用变换到主画布，在展台模式下只对摄像头容器应用变换
        applyTransform() {
            const canvas = this.$refs.mainCanvas;
            canvas.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
            
            // 如果在展台模式下，只应用变换到摄像头容器，保持叠加画布固定
            if (this.isCameraActive) {
                // 应用变换到摄像头容器
                if (this.$refs.cameraContainer) {
                    this.$refs.cameraContainer.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
                }
                
                // 叠加画布保持固定，不应用变换，并确保位置固定
                if (this.$refs.overlayCanvas) {
                    this.$refs.overlayCanvas.style.transform = 'translate(0px, 0px) scale(1)';
                    this.$refs.overlayCanvas.style.position = 'absolute';
                    this.$refs.overlayCanvas.style.top = '0px';
                    this.$refs.overlayCanvas.style.left = '0px';
                }
            }
        },
        
        // 设置当前工具
        setTool(tool) {
            this.currentTool = tool;
        },
        
        // 开始绘制
        startDrawing(e) {
            // 防止右键菜单
            if (e.button === 2) {
                e.preventDefault();
                return;
            }
            
            // 如果是移动工具，开始平移
            if (this.currentTool === 'move') {
                this.isPanning = true;
                this.panStartX = e.clientX - this.offsetX;
                this.panStartY = e.clientY - this.offsetY;
                return;
            }
            
            // 如果在展台模式下，将事件转发给叠加画布
            if (this.isCameraActive) {
                this.startDrawingOverlay(e);
                return;
            }
            
            this.isDrawing = true;
            
            // 获取相对坐标（考虑画布变换）
            const containerRect = this.$refs.canvasContainer.getBoundingClientRect();
            const x = (e.clientX - containerRect.left - this.offsetX) / this.scale;
            const y = (e.clientY - containerRect.top - this.offsetY) / this.scale;
            
            this.lastX = x;
            this.lastY = y;
        },
        
        // 绘制过程
        draw(e) {
            // 如果正在平移，更新画布位置
            if (this.isPanning) {
                this.offsetX = e.clientX - this.panStartX;
                this.offsetY = e.clientY - this.panStartY;
                this.applyTransform(); // 应用变换
                return;
            }
            
            // 如果在展台模式下，将事件转发给叠加画布
            if (this.isCameraActive) {
                this.drawOnOverlay(e);
                return;
            }
            
            // 如果没有在绘制，直接返回
            if (!this.isDrawing) return;
            
            // 如果是橡皮擦工具，使用白色绘制
            const isEraser = this.currentTool === 'eraser';
            
            const canvas = this.$refs.mainCanvas;
            const ctx = canvas.getContext('2d');
            
            // 获取相对坐标（考虑画布变换）
            const containerRect = this.$refs.canvasContainer.getBoundingClientRect();
            const x = (e.clientX - containerRect.left - this.offsetX) / this.scale;
            const y = (e.clientY - containerRect.top - this.offsetY) / this.scale;
            
            // 设置绘图样式
            ctx.lineWidth = this.penSize;
            ctx.strokeStyle = isEraser ? 'white' : this.penColor;
            
            // 开始绘制路径
            ctx.beginPath();
            ctx.moveTo(this.lastX, this.lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            
            // 更新最后位置
            this.lastX = x;
            this.lastY = y;
        },
        
        // 停止绘制
        stopDrawing() {
            // 如果在展台模式下，将事件转发给叠加画布
            if (this.isCameraActive) {
                this.stopDrawingOverlay();
            }
            
            this.isDrawing = false;
            this.isPanning = false;
            this.applyTransform();
        },

        // 叠加画布开始绘制方法
        startDrawingOverlay(e) {
            // 防止右键菜单
            if (e.button === 2) {
                e.preventDefault();
                return;
            }
            
            // 如果是移动工具，但在展台模式下，不执行平移操作
            if (this.currentTool === 'move' && this.isCameraActive) {
                // 在展台模式下禁用移动工具的平移功能
                return;
            }
            
            // 如果是移动工具（仅在非展台模式下），开始平移
            if (this.currentTool === 'move') {
                this.isPanning = true;
                this.panStartX = e.clientX - this.offsetX;
                this.panStartY = e.clientY - this.offsetY;
                return;
            }
            
            // 只有在画笔或橡皮擦模式下才允许绘制
            if (this.currentTool !== 'pen' && this.currentTool !== 'eraser') return;
            
            this.isDrawing = true;
            
            // 获取叠加画布上的坐标
            const rect = this.$refs.overlayCanvas.getBoundingClientRect();
            this.lastX = e.clientX - rect.left;
            this.lastY = e.clientY - rect.top;
        },

        // 叠加画布绘制方法
        drawOnOverlay(e) {
            // 在展台模式下禁用移动工具的平移功能
            if (this.isPanning && this.isCameraActive) {
                // 不执行任何操作，保持叠加画布固定
                return;
            }
            
            // 如果正在平移（仅在非展台模式下），更新画布位置
            if (this.isPanning) {
                this.offsetX = e.clientX - this.panStartX;
                this.offsetY = e.clientY - this.panStartY;
                this.applyTransform(); // 应用变换
                return;
            }
            
            // 如果没有在绘制，则直接返回
            if (!this.isDrawing) return;
            
            // 只有在画笔或橡皮擦模式下才允许绘制
            if (this.currentTool !== 'pen' && this.currentTool !== 'eraser') return;
            
            const canvas = this.$refs.overlayCanvas;
            const ctx = canvas.getContext('2d');
            
            // 获取叠加画布上的坐标
            const rect = canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            // 保存当前上下文状态
            ctx.save();
            
            // 根据当前工具设置绘图属性
            if (this.currentTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = this.eraserSize;
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.lineWidth = this.penSize;
                ctx.strokeStyle = this.penColor;
            }
            
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            // 绘制线条
            ctx.beginPath();
            ctx.moveTo(this.lastX, this.lastY);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
            
            // 恢复上下文状态
            ctx.restore();
            
            // 更新最后坐标
            this.lastX = currentX;
            this.lastY = currentY;
        },

        // 叠加画布停止绘制方法
        stopDrawingOverlay(e) {
            this.isDrawing = false;
            this.isPanning = false;
            this.applyTransform();
        },

        // 处理缩放
        handleZoom(e) {
            e.preventDefault();
            
            // 在展台模式下，不处理缩放
            if (this.isCameraActive) {
                return;
            }
            
            // 获取鼠标相对于画布容器的位置
            const rect = this.$refs.canvasContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // 计算缩放因子
            const zoomIntensity = 0.1;
            const wheel = e.deltaY < 0 ? 1 : -1;
            const zoom = Math.exp(wheel * zoomIntensity);
            
            // 限制缩放范围
            const newScale = Math.max(0.1, Math.min(5, this.scale * zoom));
            
            // 调整偏移量以保持鼠标位置不变
            this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
            this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
            
            // 更新缩放比例
            this.scale = newScale;
            this.applyTransform();
        },
        
        // 放大
        zoomIn() {
            // 在展台模式下，不执行缩放操作
            if (this.isCameraActive) {
                return;
            }
            
            this.scale = Math.min(5, this.scale * 1.2);
            this.applyTransform();
        },
        
        // 缩小
        zoomOut() {
            // 在展台模式下，不执行缩放操作
            if (this.isCameraActive) {
                return;
            }
            
            this.scale = Math.max(0.1, this.scale * 0.8);
            this.applyTransform();
        },
        
        // 清空白板
        clearCanvas() {
            // 如果在展台模式下，清空叠加层画布
            if (this.isCameraActive && this.$refs.overlayCanvas) {
                const overlayCanvas = this.$refs.overlayCanvas;
                const overlayCtx = overlayCanvas.getContext('2d');
                overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            } else {
                // 否则清空主画布
                const canvas = this.$refs.mainCanvas;
                const ctx = canvas.getContext('2d');
                
                // 清空整个画布
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // 重新填充白色背景
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        },
        
        // 保存为图片
        saveAsImage() {
            const canvas = this.$refs.mainCanvas;
            const link = document.createElement('a');
            link.download = 'whiteboard.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        },
        
        // 白板/展台切换
        async toggleWhiteboardCamera() {
            if (this.isCameraActive) {
                // 当前是展台模式，切换到白板模式
                // 关闭摄像头
                if (this.cameraStream) {
                    const tracks = this.cameraStream.getTracks();
                    tracks.forEach(track => track.stop());
                }
                this.isCameraActive = false;
                this.isCameraFrozen = false;
                
                // 清理叠加画布事件监听器
                if (this.overlayEventListeners && this.$refs.overlayCanvas) {
                    this.overlayEventListeners.forEach(({ event, handler }) => {
                        this.$refs.overlayCanvas.removeEventListener(event, handler);
                    });
                    this.overlayEventListeners = [];
                }
            } else {
                // 当前是白板模式，切换到展台模式
                // 重置缩放到100%
                this.scale = 1;
                this.offsetX = 0;
                this.offsetY = 0;
                
                // 开启摄像头
                try {
                    // 检查是否支持mediaDevices API
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        throw new Error('浏览器不支持摄像头功能');
                    }
                    
                    // 先设置状态为激活，确保摄像头元素会被渲染
                    this.isCameraActive = true;
                    
                    // 使用 $nextTick 确保DOM更新后再访问元素
                    this.$nextTick(async () => {
                        try {
                            // 请求摄像头权限，使用更兼容的参数
                            this.cameraStream = await navigator.mediaDevices.getUserMedia({ 
                                video: true,  // 使用最简单的参数
                                audio: false 
                            });
                            
                            // 再次使用 $nextTick 确保摄像头元素已经渲染
                            this.$nextTick(() => {
                                // 检查摄像头视频元素是否存在
                                if (this.$refs.cameraVideo) {
                                    this.$refs.cameraVideo.srcObject = this.cameraStream;
                                    
                                    // 初始化叠加画布
                                    this.$nextTick(() => {
                                        this.initOverlayContent();
                                        this.attachOverlayEvents();
                                        // 应用变换以确保摄像头容器和叠加画布正确初始化
                                        this.applyTransform();
                                    });
                                } else {
                                    console.error('无法找到摄像头视频元素');
                                    alert('无法找到摄像头视频元素');
                                    // 如果元素不存在，关闭摄像头状态
                                    this.isCameraActive = false;
                                    if (this.cameraStream) {
                                        const tracks = this.cameraStream.getTracks();
                                        tracks.forEach(track => track.stop());
                                    }
                                }
                            });
                        } catch (err) {
                            console.error('无法获取摄像头流:', err);
                            this.isCameraActive = false;
                            throw err;
                        }
                    });
                } catch (err) {
                    console.error('无法访问摄像头:', err);
                    this.isCameraActive = false;
                    // 提供更详细的错误信息
                    if (err.name === 'NotAllowedError') {
                        alert('摄像头访问被拒绝，请在浏览器设置中允许摄像头权限');
                    } else if (err.name === 'NotFoundError') {
                        alert('未找到可用的摄像头设备');
                    } else if (err.name === 'NotReadableError') {
                        alert('摄像头正被其他应用占用，请关闭其他使用摄像头的应用');
                    } else if (err.name === 'OverconstrainedError') {
                        alert('摄像头不支持请求的分辨率');
                    } else {
                        alert('无法访问摄像头：' + err.message);
                    }
                }
            }
        },
        
        // 开启/关闭摄像头（保留原始方法以确保向后兼容）
        async toggleCamera() {
            return this.toggleWhiteboardCamera();
        },
        
        // 冻结/解冻摄像头画面
        toggleCameraFreeze() {
            if (!this.isCameraActive) return;
            
            this.isCameraFrozen = !this.isCameraFrozen;
            // 检查摄像头视频元素是否存在
            if (this.$refs.cameraVideo) {
                if (this.isCameraFrozen) {
                    // 冻结画面：暂停视频播放以保持最后一帧
                    this.$refs.cameraVideo.pause();
                } else {
                    // 解冻画面：恢复视频播放
                    this.$refs.cameraVideo.play();
                }
            }
        },
        
        
        
        // 处理键盘按下事件
        handleKeyDown(e) {
            // 空格键切换到移动工具
            if (e.code === 'Space' && this.currentTool !== 'move') {
                this.previousTool = this.currentTool;
                this.setTool('move');
            }
            
            // Ctrl+Z 或 Cmd+Z 撤销（简化实现）
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                // 这里可以实现撤销功能
                console.log('撤销操作');
            }
        },
        
        // 处理键盘抬起事件
        handleKeyUp(e) {
            // 松开空格键恢复之前的工具
            if (e.code === 'Space' && this.currentTool === 'move' && this.previousTool) {
                this.setTool(this.previousTool);
                this.previousTool = null;
            }
        }
    }
}).mount('#app');