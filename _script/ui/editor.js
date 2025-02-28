import Canvas from "./canvas.js";
import {$div} from "../util/dom.js";
import EventBus from "../util/eventbus.js";
import {COMMAND, EVENT} from "../enum.js";
import EditPanel from "./editpanel.js";
import ImageProcessing from "../util/imageProcessing.js";
import ImageFile from "../image.js";
import Selection from "./selection.js";
import Palette from "./palette.js";
import Resizer from "./components/resizer.js";
import Color from "../util/color.js";
import Modal, {DIALOG} from "./modal.js";
import {releaseCanvas} from "../util/canvasUtils.js";
import Input from "./input.js";
import HistoryService from "../services/historyservice.js";
import Cursor from "./cursor.js";

var Editor = function(){
    var me = {};
    let panels=[];
    let divider;
    var container;
    var zoomFactor = 1.1;
    var activePanel;
    var currentTool = COMMAND.DRAW;
    let previousTool;
    var touchData = {};
    var state= {
        splitPanel: false
    }

    me.init=function(parent){
        container = $div("editor splitpanel","",parent);
        panels.push(EditPanel(container,"left"));
        divider = $div("splitter","",container,(e)=>{
            touchData.totalWidth = container.getBoundingClientRect().width;
            touchData.startWith = panels[0].getWidth();
            touchData.startWith2 = panels[1].getWidth();
            touchData.startX = parseInt(divider.style.marginLeft) || -3;
        })
        panels.push(EditPanel(container,"right"));
        activePanel = panels[0];

        divider.onDrag = function(x,y){
            let w = touchData.startWith+x;
            let w2 = touchData.startWith2-x;
            let min = 120;

            if (w<min) x = min-touchData.startWith;
            if (w2<min) x = touchData.startWith2-min;

            w = (touchData.startWith+x)*100/touchData.totalWidth;
            divider.style.left = w + "%";
            panels[0].setWidth(w,true);
            w = (touchData.startWith2-x)*100/touchData.totalWidth;
            panels[1].setWidth(w,true);
        }
        
        EventBus.on(COMMAND.ZOOMIN,function(center){
            activePanel.zoom(zoomFactor,center);
            EventBus.trigger(EVENT.sizerChanged);
        });
        EventBus.on(COMMAND.ZOOMOUT,function(center){
            activePanel.zoom(1/zoomFactor,center);
            EventBus.trigger(EVENT.sizerChanged);
        });

        //TODO: move these to ToolOptions
        EventBus.on(COMMAND.DRAW,function(){
            currentTool = COMMAND.DRAW;
            Cursor.set("draw");
        });
        EventBus.on(COMMAND.ERASE,function(){
            currentTool = COMMAND.ERASE;
            Cursor.set("draw");
        });
        EventBus.on(COMMAND.SMUDGE,function(){
            currentTool = COMMAND.SMUDGE;
        });
        EventBus.on(COMMAND.SELECT,function(){
            currentTool = COMMAND.SELECT;
            Cursor.set("select");
        });
        EventBus.on(COMMAND.POLYGONSELECT,function(){
            currentTool = COMMAND.POLYGONSELECT;
            Cursor.set("select");
        });
        EventBus.on(COMMAND.FLOODSELECT,function(){
            currentTool = COMMAND.FLOODSELECT;
            Cursor.set("select");
        });
        EventBus.on(COMMAND.FLOOD,function(){
            currentTool = COMMAND.FLOOD;
        });
        EventBus.on(COMMAND.SQUARE,function(){
            currentTool = COMMAND.SQUARE;
            Cursor.set("select");
        });
        EventBus.on(COMMAND.CIRCLE,function(){
            currentTool = COMMAND.CIRCLE;
            Cursor.set("select");
        });
        EventBus.on(COMMAND.LINE,function(){
            currentTool = COMMAND.LINE;
        });
        EventBus.on(COMMAND.GRADIENT,function(){
            currentTool = COMMAND.GRADIENT;
        });
        EventBus.on(COMMAND.PAN,function(){
            currentTool = COMMAND.PAN;
            Cursor.set("pan");
        });
        EventBus.on(COMMAND.COLORPICKER, function(){
            currentTool = COMMAND.COLORPICKER;
            Cursor.set("colorpicker");
        });
        EventBus.on(COMMAND.SPLITSCREEN,function(){
            me.splitPanel();
        });
        EventBus.on(COMMAND.ROTATE,function(){
            EventBus.trigger(COMMAND.CLEARSELECTION);
            let currentFrame = ImageFile.getActiveFrame();
            currentFrame.layers.forEach(layer=>{
                ImageProcessing.rotate(layer.getCanvas());
            })
            let w = ImageFile.getCurrentFile().width;
            ImageFile.getCurrentFile().width = ImageFile.getCurrentFile().height;
            ImageFile.getCurrentFile().height = w;
            EventBus.trigger(EVENT.imageSizeChanged);
        });
        EventBus.on(COMMAND.CLEAR,function(){
            var s = Selection.get();
            let layer = ImageFile.getActiveLayer();
            if (!layer) return;
            HistoryService.start(EVENT.layerHistory);
            if (s){
                if (s.canvas || s.points){
                    let canvas = Selection.getCanvas();
                    let layerCtx = layer.getContext();
                    layerCtx.globalCompositeOperation = "destination-out";
                    layerCtx.drawImage(canvas,0,0);
                    layerCtx.globalCompositeOperation = "source-over";
                    releaseCanvas(canvas);
                }else{
                    // rectangular selection
                    layer.getContext().clearRect(s.left,s.top,s.width,s.height);
                }
            }else{
                layer.clear();
            }
            HistoryService.end();
            EventBus.trigger(EVENT.layerContentChanged);
            EventBus.trigger(EVENT.imageContentChanged);
        });
        EventBus.on(COMMAND.CROP,function(){
            var s = Selection.get();
            if (s){
                HistoryService.start(EVENT.imageHistory);
                ImageFile.getCurrentFile().frames.forEach(frame=>{
                    frame.layers.forEach(layer=>{
                        let c = layer.getCanvas();
                        let ctx = c.getContext("2d");
                        let canvas = document.createElement("canvas");
                        canvas.width = s.width;
                        canvas.height = s.height;
                        canvas.getContext("2d").clearRect(0,0,s.width,s.height);
                        canvas.getContext("2d").drawImage(c,s.left,s.top,s.width,s.height,0,0,s.width,s.height);

                        c.width = s.width;
                        c.height = s.height;
                        ctx.clearRect(0,0,s.width,s.height);
                        ctx.drawImage(canvas,0,0);
                        releaseCanvas(canvas);
                    })
                });
                ImageFile.getCurrentFile().width = s.width;
                ImageFile.getCurrentFile().height = s.height;
                Selection.move(0,0,s.width,s.height);
                HistoryService.end();
                EventBus.trigger(EVENT.imageSizeChanged);
            }
        });
        EventBus.on(COMMAND.TRIM,()=>{
            let ctx = ImageFile.getActiveContext();
            let canvas = ctx.canvas;
            let box = ImageFile.getLayerBoundingRect();
            let cut = ctx.getImageData(box.x, box.y, box.w, box.h);
            if (box.w === canvas.width && box.h === canvas.height && box.x === 0) return;

            HistoryService.start(EVENT.imageHistory);
            canvas.width = box.w;
            canvas.height = box.h;
            ctx.putImageData(cut, 0, 0);
            ImageFile.getCurrentFile().width = canvas.width;
            ImageFile.getCurrentFile().height = canvas.height;
            HistoryService.end();
            EventBus.trigger(EVENT.imageSizeChanged);
        })

        EventBus.on(COMMAND.TRANSFORMLAYER,()=>{

            let box = ImageFile.getLayerBoundingRect();
            if (!box.w || !box.h) return;

            previousTool = currentTool;
            currentTool = COMMAND.TRANSFORMLAYER;

            Resizer.set(box.x,box.y,box.w,box.h,0,false,activePanel.getViewPort(),box.w/box.h);

            touchData.transformBox = box;
            touchData.transformCanvas = document.createElement("canvas");
            touchData.transformCanvas.width = box.w;
            touchData.transformCanvas.height = box.h;
            let ctx = touchData.transformCanvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(ImageFile.getActiveContext().canvas,box.x,box.y,box.w,box.h,0,0,box.w,box.h);

            touchData.transformLayer = ImageFile.getActiveLayer();
            Resizer.setOnUpdate(updateTransform);
        });

        EventBus.on(COMMAND.COLORMASK,()=>{
            let ctx = ImageFile.getActiveContext();
            let color = Palette.getDrawColor();
            let w = ImageFile.getCurrentFile().width;
            let h = ImageFile.getCurrentFile().height;
            let data = ctx.getImageData(0,0,w,h).data;
            let layerIndex = ImageFile.addLayer();
            let layer = ImageFile.getLayer(layerIndex);
            layer.type = "pixelSelection";
            let ctx2 = ImageFile.getLayer(layerIndex).getContext();
            ctx2.fillStyle = "red";
            let count = 0;
            for (let y = 0;y<h;y++){
                for (let x = 0;x<w;x++){
                    let index = (y*w + x) * 4;
                    let r = data[index];
                    let g = data[index+1];
                    let b = data[index+2];
                    let c = Color.toString([r,g,b]);
                    if (c === color){
                        count++;
                        ctx2.fillRect(x,y,1,1);
                    }
                }
            }
            EventBus.trigger(EVENT.imageContentChanged);
            EventBus.trigger(EVENT.colorCount,count);
            return layerIndex;
        })

        EventBus.on(COMMAND.LAYERMASK,(hide)=>{
            let layer = ImageFile.getActiveLayer();
            layer.addMask(!!hide);
            EventBus.trigger(EVENT.layerContentChanged);
            EventBus.trigger(EVENT.layersChanged);
        });
        EventBus.on(COMMAND.LAYERMASKHIDE,()=>{
            EventBus.trigger(COMMAND.LAYERMASK,true);

            setTimeout(()=>{
                EventBus.trigger(EVENT.layerContentChanged);
                EventBus.trigger(EVENT.layersChanged);
            },1000)
        });
        EventBus.on(COMMAND.DELETELAYERMASK,()=>{
            let layer = ImageFile.getActiveLayer();
            layer.removeMask();
            EventBus.trigger(EVENT.layerContentChanged);
            EventBus.trigger(EVENT.layersChanged);
        });
        EventBus.on(COMMAND.APPLYLAYERMASK,()=>{
            let layer = ImageFile.getActiveLayer();
            layer.removeMask(true);
            EventBus.trigger(EVENT.layerContentChanged);
            EventBus.trigger(EVENT.layersChanged);
        });
        EventBus.on(COMMAND.EDITPALETTE, ()=>{
            Modal.show(DIALOG.PALETTE);
        })
        EventBus.on(COMMAND.EFFECTS, ()=>{
            Modal.show(DIALOG.EFFECTS);
        })
        EventBus.on(EVENT.toolChanged,(tool)=>{
            me.commit();
            Cursor.reset();
        });

    }

    me.set = function(image){
        //panels.forEach(panel=>panel.set(image,true));
    }

    me.setPanel = function(image,index){
        //panels[index].set(image,false);
    }

    me.setActivePanel = function(panel){
        activePanel = panels[panel];
    }

    me.getActivePanel = function(){
        return activePanel;
    }

    me.getCurrentTool = function(){
        return currentTool;
    }

    me.splitPanel = function(){
        state.splitPanel = !state.splitPanel;
        if (divider.style.display === "block"){
            panels[0].setWidth(100,true);
            panels[1].hide();
            divider.style.display = "none";
        }else{
            panels[0].setWidth("calc(50% - 4px)");
            panels[1].setWidth("calc(50% - 4px)");
            panels[1].show();
            divider.style.display = "block";
            EventBus.trigger(EVENT.imageSizeChanged);
        }
    }

    me.isStateActive = function(name){
        return !!state[name];
    }

    me.commit = function(){
        if (currentTool === COMMAND.TRANSFORMLAYER){
            console.log("commit layer");
            Resizer.commit();
            updateTransform();
            clearTransform();
            EventBus.trigger(COMMAND.CLEARSELECTION);
            currentTool = undefined;
            if (previousTool) EventBus.trigger(previousTool);
        }
        if (currentTool === COMMAND.POLYGONSELECT){
            EventBus.trigger(COMMAND.ENDPOLYGONSELECT);
        }
    }

    me.reset = function(){
        if (currentTool === COMMAND.TRANSFORMLAYER){
            Resizer.commit();
            resetTransform();
            clearTransform();
            currentTool = undefined;
        }
        EventBus.trigger(COMMAND.CLEARSELECTION);
    }

    me.arrowKey = function(direction){
        let x = 0;
        let y = 0;
        switch (direction){
            case "left": x=-1; break;
            case "right": x=1; break;
            case "up": y=-1; break;
            case "down": y=1; break;
        }
        if (Input.isMetaDown()){
            x*=10;
            y*=10;
        }
        if (currentTool === COMMAND.DRAW){
            if (x>0) Palette.next();
            if (x<0) Palette.prev();
            return;
        }
        Resizer.move(x,y);
    }

    me.setZoom = function(factor,center){
        activePanel.setZoom(factor,center);
    }

    me.canPickColor = ()=>{
        let ct = Editor.getCurrentTool();
        return !(ct === COMMAND.SELECT || ct === COMMAND.SQUARE || ct === COMMAND.GRADIENT || ct === COMMAND.LINE || ct === COMMAND.CIRCLE  ||  ct === COMMAND.TRANSFORMLAYER);
    }

    function updateTransform(){
        if (!touchData.transformLayer) return;
        console.log("update transform layer");
        let d = Resizer.get();
        touchData.transformLayer.clear();
        if (d.width === 0 || d.height === 0) return;
        let ctx = touchData.transformLayer.getContext();
        ctx.imageSmoothingEnabled = false;
        if (d.rotation){
            console.log("rotate " + d.rotation);

            let dw = (d.left + d.width/2);
            let dh = (d.top + d.height/2);
            ctx.translate(dw,dh);
            ctx.rotate((d.rotation * Math.PI) / 180);
            ctx.translate(-dw,-dh);
        }
        ctx.drawImage(touchData.transformCanvas,d.left,d.top,d.width,d.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        EventBus.trigger(EVENT.layerContentChanged);
    }

    function resetTransform(){
        touchData.transformLayer.clear();
        let ctx = touchData.transformLayer.getContext();
        let box = touchData.transformBox;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(touchData.transformCanvas,box.x,box.y,box.w,box.h);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        EventBus.trigger(EVENT.layerContentChanged);
    }

    function clearTransform(){
        touchData.transformBox = undefined;
        if (touchData.transformCanvas) releaseCanvas(touchData.transformCanvas);
        touchData.transformLayer = undefined;
    }


    return me;
}();

export default Editor;