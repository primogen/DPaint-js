import $, {$checkbox, $div, $elm, $setTarget, $input} from "../../util/dom.js";
import ImageFile from "../../image.js";
import Palette from "../palette.js";
import Color from "../../util/color.js";
import canvas from "../canvas.js";
import {COMMAND, EVENT} from "../../enum.js";
import EventBus from "../../util/eventbus.js";
import Input from "../input.js";
import ColorRange from "./colorRange.js";

var PaletteDialog = function() {
    let me = {};
    let colorCanvas;
    let colorCanvasCtx;
    let paletteCanvas;
    let paletteCanvasCtx;
    let sliders = [];
    let tabs = {};
    let panels = {};
    let buttons;
    let inputHex;
    let colorHighlight;
    let colorPicker;
    let lockToImage = true;
    let highlight = false;
    let pixelCount;
    let currentIndex;
    let colorSize = 30;
    let palettePage = 0;
    let swapButton;
    let spreadButton;
    let paletteClickAction = "";
    let withActions = false;
    let panelContainer;
    let hsv = false;

    me.render = function (container,modal) {
        container.innerHTML = "";
        sliders = [];
        paletteClickAction = "";

        let currentColor = Palette.getDrawColor();

        let palettePanel;
        let subPanel;
        let optionsPanel;
        let contextMenu;

        $setTarget(container);
        panelContainer = $(".palette.panel.form" + (withActions? ".withactions" : ""),
            palettePanel=$(".palettepanel"),
            $(".actions",
                $(".caption.sub",{onClick:()=>{
                        withActions=false;
                        panelContainer.classList.toggle("withactions",withActions);
                    }},"Actions"),
                $(".nav",$(".zoomin",{
                        onClick:()=>{colorSize = Math.min(colorSize*2,60); renderPalette(palettePanel);},
                        info: "Draw bigger color squares"
                    }),
                    $(".zoomout",{
                        onClick:()=>{colorSize = Math.max(colorSize/2,15); renderPalette(palettePanel);},
                        info: "Draw smaller color squares"
                    })),
                swapButton = $(".button.small",{
                    onClick:()=>{
                        let active = paletteClickAction === "swap";
                        active = !active;
                        paletteClickAction = active?"swap":"";
                        swapButton.classList.toggle("highlight",active);
                        if (active){
                            let dupe = $div("dragelement tooltip","Swap with");
                            Input.setDragElement(dupe,true);
                        }else{
                            Input.removeDragElement();
                        }
                    },
                    info:"Swap a color in the palette"
                },"Swap"),
                spreadButton = $(".button.small",{
                    onClick:()=>{
                        let active = paletteClickAction === "spread";
                        active = !active;
                        paletteClickAction = active?"spread":"";
                        spreadButton.classList.toggle("highlight",active);
                        if (active){
                            let dupe = $div("dragelement tooltip","Spread to");
                            Input.setDragElement(dupe,true);
                        }else{
                            Input.removeDragElement();
                        }
                    },
                    info:"Create a color gradient between 2 colors in the palette."
                },"Spread"),
                $(".button.small",{onClick:()=>{Palette.addColor(Color.fromString(inputHex.value))},"info":"Add a new color"},"Add"),
                $(".button.small",{onClick:()=>{Palette.removeColor(currentIndex)},"info":"Remove the selected color"},"Remove"),
                $(".spacer"),
                $(".button.small",{onClick:()=>{contextMenu.classList.toggle("active")}},"Sort",contextMenu = $(".contextmenu",
                        $(".item",{onClick:()=>{Palette.reverse(); contextMenu.classList.remove("active")},"info":"Reverse the colors in the palette"},"Reverse"),
                        $(".item",{onClick:()=>{Palette.sortByHue(); contextMenu.classList.remove("active")},"info":"Sort by hue"},"Hue"),
                        $(".item",{onClick:()=>{Palette.sortBySaturation(); contextMenu.classList.remove("active")},"info":"Sort by saturation"},"Saturation"),
                        $(".item",{onClick:()=>{Palette.sortByLightness(); contextMenu.classList.remove("active")},"info":"Sort by lightness"},"Lightness"))),
                $(".button.small",{onClick:()=>{EventBus.trigger(COMMAND.LOADPALETTE)},"info":"Open palette from disk"},"Load"),
                $(".button.small",{onClick:()=>{EventBus.trigger(COMMAND.SAVEPALETTE)},"info":"Save palette to disk"},"Save"),
            ),
            $(".mainpanel",
                $('.tabs',panels.colortab = $(".caption.sub",{onClick:toggleRangePanel},"Color"),panels.rangestab = $(".caption.sub.inactive",{onClick:toggleRangePanel},"Ranges")),
                panels.color = $(".colorpanel",
                    $(".sliders",
                    colorCanvas = $("canvas",{
                        width:60,
                        height:30,
                        onclick:()=>{colorPicker.click();}
                    }),
                    colorPicker = $("input.masked",{
                        type:"color",
                        value:Color.toHex(currentColor),
                        oninput: ()=>{
                            inputHex.value = colorPicker.value;
                            updateColor(inputHex.value);
                        }
                    }),
                    pixelCount = $(".pixelcount"),
                    inputHex = $("input.hex",{
                        type:"text",
                        value:Color.toHex(currentColor),
                        oninput: ()=>{
                            updateColor(inputHex.value);
                        },
                        onkeydown: modal.inputKeyDown
                    }), $(".tabs",
                            tabs.rgb = $(".tab",{onClick:toggleHSV}, $("span","R G B")),
                            tabs.hsv = $(".tab.inactive",{onClick:toggleHSV},$("span","H S V")),
                            subPanel=$(".panel"))
                    ),
                    buttons = $(".buttons"),
                    optionsPanel=$(".options")
                ),
                panels.ranges = $(".rangepanel")
            ),
        );

        renderPalette(palettePanel);
        colorCanvasCtx = colorCanvas.getContext("2d");
        colorCanvasCtx.fillStyle = currentColor;
        colorCanvasCtx.fillRect(0,0,60,30);


        let RGBValues = Color.fromString(currentColor);
        ["red","green","blue"].forEach((color,index)=>{
            let slider = $div("slider","",subPanel);
            let range =  document.createElement("input");
            range.type = "range";
            range.className = "slider " + color;
            range.max = 255;
            range.value = RGBValues[index];
            slider.appendChild(range);
            let label = $elm("span",color,slider,"label");
            let input = document.createElement("input");
            input.type = "text";
            input.className = "rangevalue";
            input.value = RGBValues[index];
            input.onkeydown = modal.inputKeyDown;
            slider.appendChild(input);
            sliders.push({
                range: range,
                input: input,
                label: label
            })

            range.oninput = ()=>{
                input.value = range.value;
                let newColor = [sliders[0].input.value,sliders[1].input.value,sliders[2].input.value];
                if (hsv){
                    newColor = Color.fromHSV(sliders[0].range.value/360,sliders[1].range.value/100,sliders[2].range.value/100);
                }
                updateColor(newColor);
            }

            input.oninput = ()=>{
                let value = parseInt(input.value);
                if (isNaN(value)) value=0;
                if (value<0) value=0;
                if (value>255) value=255;
                range.value = input.value;
                let newColor = [sliders[0].range.value,sliders[1].range.value,sliders[2].range.value];
                updateColor(newColor);
            }

            //currentIndex = 0;
        })

        $div("button small revert","Revert",buttons,()=>{
            setColor(Palette.get()[currentIndex],currentIndex);
        });
        $div("button small apply","Apply",buttons,()=>{
            let color = Color.fromString(inputHex.value);
            Palette.updateColor(currentIndex,color);
            let colorsPerPage = paletteCanvas.width / colorSize * paletteCanvas.height / colorSize;
            let start = palettePage * colorsPerPage;
            drawColor(color,currentIndex-start);
            colorCanvasCtx.fillStyle = Color.toString(color);
            colorCanvasCtx.fillRect(0,0,60,30);

            if (lockToImage){
                let currentHighLight = ImageFile.getLayerIndexesOfType("pixelSelection");
                if (currentHighLight.length){
                    EventBus.trigger(COMMAND.MERGEDOWN,currentHighLight[0]);
                }
            }
        });


        $checkbox("Update image with color changes",optionsPanel,"",(checked)=>{
            lockToImage = checked;
        },lockToImage)
        $checkbox("HighLight pixels that use selected color",optionsPanel,"",(checked)=>{
            highlight = checked;
            setPixelHighLights();
        },highlight)

        if (hsv){
            hsv = false;
            toggleHSV();
        }
    }

    me.onClose = function(){
        removePixelHighLigts();
        me.clearPaletteClickAction();
        paletteCanvas = null;
        ColorRange.cleanUp();
    }

    me.setPaletteClickAction = (action)=>{
        paletteClickAction = action;
    }

    me.clearPaletteClickAction = function(){
        paletteClickAction="";
        Input.removeDragElement();
    }

    function toggleHSV(){
        hsv = !hsv;
        tabs.rgb.classList.toggle("inactive",hsv);
        tabs.hsv.classList.toggle("inactive",!hsv);

        let color = Color.fromString(inputHex.value);
        let labels = ["Red","Green","Blue"];
        let max = [255,255,255];
        if (hsv){
            color = Color.toHSV(color,true);
            labels = ["Hue","Sat.","Value"];
            max = [360,100,100];
        }
        sliders.forEach((slider,index)=>{
            slider.range.max = max[index];
            slider.range.value = slider.input.value = color[index];
            slider.label.innerText = labels[index];
            slider.range.classList.toggle("hsv",hsv);
        })
    }

    function toggleRangePanel(){
        if (panels.colortab.classList.contains("inactive")){
            panels.colortab.classList.remove("inactive");
            panels.rangestab.classList.add("inactive");
            panels.color.style.display = "block";
            panels.ranges.style.display = "none";
            ColorRange.cleanUp();
        }else{
            panels.colortab.classList.add("inactive");
            panels.rangestab.classList.remove("inactive");
            panels.color.style.display = "none";
            panels.ranges.style.display = "block";
            ColorRange.render(panels.ranges);
        }
    }



    function renderPalette(parent){
        parent.innerHTML = "";
        paletteCanvas = $("canvas",{width:120,height:240});
        paletteCanvasCtx = paletteCanvas.getContext("2d");
        let colors = Palette.get();
        colorHighlight = $div("highlight","",parent);

        let colorsPerPage = paletteCanvas.width / colorSize * paletteCanvas.height / colorSize;
        let pageCount = Math.ceil(colors.length/colorsPerPage);
        if (palettePage>=pageCount) palettePage = pageCount-1;

        let isInRange = ()=>{return false;}
        if (ColorRange.getActiveRange() !== undefined){
            let range = ImageFile.getCurrentFile().colorRange[ColorRange.getActiveRange()];
            isInRange = (index)=>{
                return index >= range.low && index <= range.high;
            }
        }

        let start = palettePage * colorsPerPage;
        let end = start + colorsPerPage;
        for (let i=start;i<end;i++){
            if (!colors[i]) break;
            drawColor(colors[i],i-start,isInRange(i));
        }

        paletteCanvas.onpointerdown = function(e){
            const rect = paletteCanvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / colorSize);
            const y = Math.floor((e.clientY - rect.top) / colorSize);
            let colorsPerRow = paletteCanvas.width / colorSize;
            let index = (y*colorsPerRow + x) + start;
            if (paletteClickAction === "swap"){
                Palette.swapColors(currentIndex,index);
                me.clearPaletteClickAction();
                swapButton.classList.remove("highlight");
            }
            if (paletteClickAction === "spread"){
                Palette.spreadColors(currentIndex,index);
                me.clearPaletteClickAction();
                spreadButton.classList.remove("highlight");
            }
            if (paletteClickAction === "rangeto"){
                ColorRange.setTo(index);
                me.clearPaletteClickAction();
            }
            if (paletteClickAction === "rangefrom"){
                ColorRange.setFrom(index);
                Input.removeDragElement();
                let dupe = $div("dragelement tooltip","Select range: To color");
                Input.setDragElement(dupe,true);
                paletteClickAction = "rangeto";
            }

            setColor(colors[index],index);
        }

        parent.appendChild($(".caption.sub",{
            onClick:()=>{
                withActions=!withActions;
                panelContainer.classList.toggle("withactions",withActions);
            },
            info:"Show palette and color actions"},"Palette"));
        parent.appendChild(paletteCanvas);

        if (colors.length>colorsPerPage){
            $(".nav",{parent:parent},
                $(".prev"+(palettePage?".active":""),{onClick:()=>{palettePage--;renderPalette(parent);}}),
                $(".page",""+(palettePage+1)),
                $(".next"+(palettePage<pageCount-1?".active":""),{onClick:()=>{palettePage++;renderPalette(parent);}})
            );
        }else{
            palettePage = 0;
        }

        setColorSelection();
    }


    function drawColor(color,index,highlight){
        let colorsPerRow = paletteCanvas.width / colorSize;
        let x = (index%colorsPerRow) * colorSize;
        let y = Math.floor(index/colorsPerRow) * colorSize;
        let c = Color.toString(color);
        paletteCanvasCtx.fillStyle = c;
        paletteCanvasCtx.fillRect(x,y,colorSize,colorSize);
        if (highlight){
            paletteCanvasCtx.beginPath();
            paletteCanvasCtx.strokeStyle = "rgba(255,255,255,0.8)";
            paletteCanvasCtx.lineWidth = 1;
            paletteCanvasCtx.rect(x+1.5,y+1.5,colorSize-3,colorSize-3);
            paletteCanvasCtx.closePath();
            paletteCanvasCtx.stroke();
        }
        if (c === Palette.getDrawColor()){
            currentIndex = index;
            colorHighlight.style.left = x + "px";
            colorHighlight.style.top = y + "px";
        }
    }

    function setColor(color,index){
        if (index>=Palette.get().length) return;
        currentIndex = index;
        Palette.setColor(color);
    }

    function setColorSelection(){
        let colorsPerRow = paletteCanvas.width / colorSize;
        let colorsPerPage = colorsPerRow * paletteCanvas.height / colorSize;
        let visualIndex =  currentIndex - (palettePage * colorsPerPage);
        if ((visualIndex<0) || (visualIndex>=colorsPerPage)){
            colorHighlight.style.display = "none";
        }else{
            colorHighlight.style.display = "block";
            colorHighlight.style.left = (visualIndex%colorsPerRow * colorSize)+ "px";
            colorHighlight.style.top = (Math.floor(visualIndex/colorsPerRow) * colorSize) + "px";
            colorHighlight.style.width = colorHighlight.style.height = colorSize + "px";
        }

    }

    function setPixelHighLights(){
        removePixelHighLigts();
        if (highlight){
            EventBus.trigger(COMMAND.COLORMASK);
        }
    }

    function removePixelHighLigts(){
        let currentHighLight = ImageFile.getLayerIndexesOfType("pixelSelection");
        currentHighLight.forEach(layerIndex=>{
            ImageFile.removeLayer(layerIndex);
        })
    }

    function updateColor(color){
        if (typeof color === "string" && color.substr(0,1) === "#"){
            color = color + "000000";
            color=color.substr(0, 7);
            color = Color.fromString(color);
            if (hsv) color = Color.toHSV(color,true);
            sliders.forEach((slider,index)=>{
                slider.range.value = slider.input.value = color[index];
            })
        }else{
            inputHex.value = Color.toHex(color);
        }
        colorCanvasCtx.fillStyle = Color.toString(color);
        colorCanvasCtx.fillRect(30,0,30,30);

        if (lockToImage){
            let currentHighLight = ImageFile.getLayerIndexesOfType("pixelSelection");
            if (!currentHighLight.length){
                EventBus.trigger(COMMAND.COLORMASK,true);
                currentHighLight = ImageFile.getLayerIndexesOfType("pixelSelection");
            }
            let colorLayer = ImageFile.getLayer(currentHighLight[0]);
            if (colorLayer){
                colorLayer.fill(color);
                EventBus.trigger(EVENT.imageContentChanged);
            }else{
                console.error("colorLayer not found");
            }
        }
        buttons.classList.add("active");
        //buttons.forEach(button=>{button.classList.add("active")})
    }

    EventBus.on(EVENT.colorCount,(count)=>{
        if (highlight) pixelCount.innerHTML = "Used on<br>"  + count + " pixels";
    })

    EventBus.on(EVENT.paletteChanged,()=>{
        if (paletteCanvas){
            console.log("render palette")
            renderPalette(paletteCanvas.parentNode);
        }
    })

    EventBus.on(EVENT.colorCycleChanged,(index)=>{
        if (!paletteCanvas) return;

        let image = ImageFile.getCurrentFile();
        let range = image.colorRange[index];

        for (let i=range.low;i<=range.high;i++){
            let index = i-(range.index || 0);
            if (index<range.low) index += range.max;
            let color = Palette.get()[index];

            let colorsPerRow = paletteCanvas.width / colorSize;
            let rows = Math.floor(paletteCanvas.height/colorSize);
            let start = palettePage * colorsPerRow * rows;

            if (i>=start && i<start+colorsPerRow*rows){
                let x = ((i-start)%colorsPerRow) * colorSize;
                let y = Math.floor((i-start)/colorsPerRow) * colorSize;
                paletteCanvasCtx.fillStyle = Color.toString(color);
                paletteCanvasCtx.fillRect(x,y,colorSize,colorSize);
            }
        }
    });

    EventBus.on(EVENT.colorRangeChanged,()=>{
        if (paletteCanvas) renderPalette(paletteCanvas.parentNode);
    });

    EventBus.on(EVENT.drawColorChanged,()=>{
        if (paletteCanvas){
            let color = Palette.getDrawColor();
            currentIndex = Palette.getDrawColorIndex();

            colorCanvasCtx.fillStyle = Color.toString(color);
            colorCanvasCtx.fillRect(0,0,60,30);
            inputHex.value = colorPicker.value = Color.toHex(color);

            if (hsv) color = Color.toHSV(color,true);
            sliders.forEach((slider,_index)=>{
                slider.range.value = color[_index];
                slider.input.value = color[_index];
            });
            setPixelHighLights();
            setColorSelection();
            buttons.classList.remove("active");
        }
    });


    return me;
}();

export default PaletteDialog;