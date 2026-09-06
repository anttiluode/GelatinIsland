#!/usr/bin/env python3
"""Render actual engine state to an MP4 with numpy/Pillow and ffmpeg.

Run: node experiments/export_frames.cjs 42 estuary | python experiments/render_movie.py --out artifacts/gelatin-estuary.mp4
Colours and lighting are a presentation layer. No trajectories are invented.
"""
import argparse,base64,json,subprocess,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont


def smooth(a,b,x):
    q=np.clip((x-a)/(b-a),0,1)
    return q*q*(3-2*q)


def render(fields):
    m,u,v,n,t,wall=[fields[:,:,i].astype(np.float32)/255 for i in range(6)]
    height=m*.72+t*.28
    dy,dx=np.gradient(height)
    dx*=2;dy*=2
    normal=np.stack([-dx*9,-dy*9,np.ones_like(dx)*.9],-1)
    normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    light=np.array([-.6,-.8,1.2]);light/=np.linalg.norm(light)
    specdir=np.array([-.5,-.65,1.8]);specdir/=np.linalg.norm(specdir)
    diffuse=np.maximum(0,normal@light)
    spec=np.maximum(0,normal@specdir)**34
    rim=(np.hypot(dx,dy)*3.6)**.8
    body=smooth(.025,.23,m*.85+t*.26)
    k=np.clip(t*.8+m*.2,0,1)[...,None]
    cold=np.array([.025,.30,.39])*(1-k)+np.array([.17,.85,.68])*k
    warm=np.array([1.,.52,.15]);memory=np.array([.34,.16,.64])
    color=np.array([.012,.024,.043])+n[...,None]*np.array([.018,.027,.034])+memory*m[...,None]*.19
    material=cold*(.16+.43*diffuse[...,None])+np.array([.35,.68,.71])*spec[...,None]*.35
    color=color*(1-body[...,None]*.92)+material*body[...,None]*.92
    color+=cold*rim[...,None]*.17
    front=u*(1-smooth(.15,.62,v))
    color+=warm*(front*.9+u*.33)[...,None]
    color+=memory*(v*body*.65)[...,None]+cold*(t*t*.3)[...,None]
    color[wall>.5]=[.065,.077,.09]
    color=np.power(1-np.exp(-np.maximum(0,color)*1.45),.88)
    return Image.fromarray(np.uint8(np.clip(color,0,1)*255))


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',default='artifacts/gelatin-estuary.mp4');args=ap.parse_args()
    dest=Path(args.out);dest.parent.mkdir(parents=True,exist_ok=True)
    header=json.loads(sys.stdin.readline());width,height=1440,880
    command=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{width}x{height}','-r',str(header['fps']),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)]
    encoder=subprocess.Popen(command,stdin=subprocess.PIPE)
    try:
        font=ImageFont.truetype('DejaVuSans.ttf',18)
        titlefont=ImageFont.truetype('DejaVuSerif.ttf',30)
    except OSError:
        font=titlefont=ImageFont.load_default()
    count=0
    try:
        for line in sys.stdin:
            data=json.loads(line);raw=base64.b64decode(data['pixels']);field=np.frombuffer(raw,np.uint8).reshape(header['height'],header['width'],6)
            im=render(field).resize((width,height),Image.Resampling.LANCZOS);draw=ImageDraw.Draw(im,'RGBA')
            sx,sy=width/header['width'],height/header['height']
            for x,y in data['carriers']:
                px,py=x*sx,y*sy;draw.ellipse((px-.6,py-.6,px+.6,py+.6),fill=(137,242,218,95))
            draw.text((35,29),'Gelatin Island',font=titlefont,fill=(230,245,244,255),stroke_width=1,stroke_fill=(8,17,22,200))
            draw.text((36,71),f"{header['preset'].title()} · seed {header['seed']} · tick {data['tick']}",font=font,fill=(182,211,218,255))
            draw.text((35,height-47),'Local carriers → material → excitation → material',font=font,fill=(182,211,218,255))
            encoder.stdin.write(im.tobytes());count+=1
            if count==150:im.save(dest.with_suffix('.png'))
        encoder.stdin.close()
        if encoder.wait()!=0:raise RuntimeError('ffmpeg failed')
        if count!=header['frames']:raise RuntimeError(f'Incomplete frame stream: {count}/{header["frames"]}')
        dest.with_suffix('.json').write_text(json.dumps({**header,'renderedFrames':count,'movieSeconds':count/header['fps'],'renderWidth':width,'renderHeight':height,'note':'Exact engine fields, quantized to 8 bits, shaded offline. Five ticks per frame: 5× default playback. Not a browser recording.'},indent=2))
        print(f'Rendered {count} frames to {dest}',file=sys.stderr)
    except Exception:
        encoder.kill();encoder.wait();raise

if __name__=='__main__':main()
