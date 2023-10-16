import React, { useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Image, ActivityIndicator, StatusBar } from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import Button from './src/components/Button';
import axios from 'axios';
import Canvas from 'react-native-canvas';
import * as FileSystem from 'expo-file-system';
import RNFS from 'react-native-fs';

const CLASS_COLORS = {
  0: {
    border: 'rgb(249, 146, 82)',
    fill: 'rgba(249, 146, 82, 0.5)'
  },
  1: {
    border: 'rgb(96, 153, 99)',
    fill: 'rgba(96, 153, 99, 0.5)'
  },
  2: {
    border: 'rgb(137, 157, 179)',
    fill: 'rgba(137, 157, 179, 0.5)'
  },
  3: {
    border: 'rgb(157, 98, 120)',
    fill: 'rgba(157, 98, 120, 0.5)'
  },
  4: {
    border: 'rgb(57, 88, 106)',
    fill: 'rgba(57, 88, 106, 0.5)'
  },
  5: {
    border: 'rgb(216, 96, 104)',
    fill: 'rgba(216, 96, 104, 0.5)'
  },
  6: {
    border: 'rgb(183, 134, 107)',
    fill: 'rgba(183, 134, 107, 0.5)'
  }
}

const URL = process.env.URL;

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function detect(imageFile, confThres=0.25, iouThres=0.45, retries=10, delay=0) {
  const data = new FormData();
    data.append('image', imageFile);
    data.append('conf_thres', confThres);
    data.append('iou_thres', iouThres);
  try {
    const response = await axios({ 
      method: 'POST', 
      url: URL, 
      data: data, 
      headers: { 'Content-Type': 'multipart/form-data' }});
    console.log(response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 0 || error.response.status === 413) throw new Error('image too large, please select an image smaller than 25MB.');
      else if (error.response.status === 403) throw new Error('you reached your monthly requests limit. Upgrade your plan to unlock unlimited requests.');
      else if (error.response.data) throw new Error(error.response.data.message);
    } else if (retries > 0) {
      if (delay > 0) await sleep(delay);
      return await detect(imageFile, confThres, iouThres, retries - 1, 2);
    } else {
      return [];
    }
  }
}

export default function App() {
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [image, setImage] = useState(null);
  const [imageWidth, setImageWidth] = useState(null);
  const [imageHeight, setImageHeight] = useState(null);
  const [originalImageWidth, setOriginalImageWidth] = useState(null);
  const [type, setType] = useState(Camera.Constants.Type.back);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [detections, setDetections] = useState([]);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      MediaLibrary.requestPermissionsAsync();
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cameraStatus.status === 'granted');
    })();
  }, []);

  useEffect(() => {
    if (image) {
      detectPicture();
    }
  }, [image])

  const takePicture = async () => {
    if (cameraRef) {
      try {
        const data = await cameraRef.current.takePictureAsync();
        setOriginalImageWidth(data.width);
        setImage(data.uri);
        await detectPicture();
      } catch (error) {
        console.log(error);
      }
    }
  };

  const detectPicture = async () => {
    if (image) {
      try {
        console.log(image)
        setDetections([]);
        setDetecting(true);
        setDetected(false);
        const detectedCeleb = await detect(image);
        console.log(detectedCeleb)
        setDetecting(false);
        setDetected(true);
        setDetections(detectedCeleb.predictions);
      } catch (error) {
        console.log(error);
      }
    }
  };

  function retake() {
    setImage(null);
    setDetections([]);
    setDetecting(false);
    setDetected(false);
    FileSystem.deleteAsync(image);
  }
  
  function drawLabel(ctx, box, scale, canvas) {
    ctx.font = '1em Arial';

    const text = box.class;
    const textMeasure = ctx.measureText(text);
    const horizontalPadding = 5;
    const verticalPadding = 5;
    const textWidth = textMeasure.width + horizontalPadding * 2;
    const textHeight = parseInt(ctx.font) + verticalPadding * 2;
    let x = box.x * scale;
    let y = box.y * scale;

    if (x < 0) x = 0;
    else if (x + textWidth > canvas.width) x = canvas.width - textWidth;

    if (y - textHeight < 0) y = textHeight;
    else if (y + textHeight > canvas.height) y = canvas.height - textHeight;

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 0.1;
    ctx.fillText(text, x + horizontalPadding, y + 6 * (textHeight / 4));
    ctx.strokeText(text, x + horizontalPadding, y + 6 * (textHeight / 4));
  }

  function drawBox(ctx, box, scale) {
    ctx.beginPath();
    ctx.rect(
      box.x * scale,
      box.y * scale,
      box.width * scale,
      box.height * scale
    );
    ctx.lineWidth = 1.5;
    console.log(CLASS_COLORS[box.class_id], box.class)
    ctx.fillStyle = CLASS_COLORS[box.class_id].fill;
    ctx.strokeStyle = CLASS_COLORS[box.class_id].border;
    ctx.fill();
    ctx.stroke();
  }

  function drawDetection(ctx, detection, scale, canvas) {
    drawBox(ctx, detection, scale);
    drawLabel(ctx, detection, scale, canvas);
  }

  function handleCanvas(canvas) {
    if (canvas) {
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      detections.forEach((detection) => {
        drawDetection(ctx, detection, imageWidth / originalImageWidth, canvas);
      });
    }
  }

  if (hasCameraPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <Text style={styles.appTitle}>RECOGNITION CELEBRITY</Text>
      </View>
      <StatusBar backgroundColor={'transparent'} translucent />
      {!image ? (
        <Camera
          style={styles.camera}
          type={type}
          ref={cameraRef}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 30,
            }}
          >
          </View>
        </Camera>
      ) : (
        <View style={styles.camera}>
          <Image source={{ uri: image }} style={styles.image}
            onLayout={(event) => {
              var { x, y, width, height } = event.nativeEvent.layout;
              setImageWidth(width);
              setImageHeight(height);
            }} />
          {detecting &&
            <View style={styles.loadingContainer}>
              <ActivityIndicator size='large' color='#ffffff' />
            </View>
          }
          <Canvas ref={handleCanvas} />
        </View>
      )}
      <View style={styles.controls}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-evenly'
          }}
        >
          {image ? <Button
            onPress={retake}
            icon='ios-reload'
          />
            :
            <Button
              icon='camera-reverse'
              onPress={() => {
                setType(
                  type === CameraType.back ? CameraType.front : CameraType.back
                );
              }}
            />
          }
          <Button disabled={detected} onPress={takePicture} icon='radio-button-on-outline'/>
        </View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  controls: {
    flex: 0.5,
    paddingTop: 10,
    backgroundColor: '#ff9900',
    justifyContent: 'center'
  },
  text: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#E9730F',
    marginLeft: 10,
  },
  camera: {
    flex: 2,
    borderRadius: 20
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  image: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%'
  },
  prediction: {
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%'
  },
  appTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center'
  },
  topControls: {
    flex: 1,
  },
});
