export type Tool = 'brush' | 'eraser' | 'fill' | 'eyedropper' | 'move';

export interface LayerData {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;       // 0-1
  dataUrl: string;       // PNG data URL
  offsetX: number;
  offsetY: number;
}

export interface Artwork {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: LayerData[];
  thumb: string;
  updatedAt: number;
}
