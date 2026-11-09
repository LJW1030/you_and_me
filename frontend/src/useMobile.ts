import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { api, qc } from './api';

export async function enablePush() {
  if(!Capacitor.isNativePlatform()) throw new Error('알림은 안드로이드 앱에서 설정할 수 있습니다.');
  const status = await api('/push/status');
  if(!status.enabled) throw new Error('서버의 Firebase 설정이 아직 완료되지 않았습니다.');
  let permission = await PushNotifications.checkPermissions();
  if(permission.receive === 'prompt') permission = await PushNotifications.requestPermissions();
  if(permission.receive !== 'granted') throw new Error('휴대폰 앱 설정에서 알림 권한을 허용해주세요.');
  await PushNotifications.createChannel({id:'messages',name:'새 메시지',importance:4,visibility:0});
  await PushNotifications.register();
}
export function useMobile(userId: number | undefined) {
  const navigate=useNavigate();
  useEffect(() => {
    if(!Capacitor.isNativePlatform()) return;
    let disposed=false;
    const handles: PluginListenerHandle[]=[];
    const keep=async(p:Promise<PluginListenerHandle>) => {const h=await p; if(disposed) await h.remove(); else handles.push(h);};
    void keep(App.addListener('backButton', () => {
      if(location.pathname !== '/') navigate('/'); else void App.minimizeApp();
    }));
    void keep(App.addListener('appStateChange', ({isActive}) => {
      window.dispatchEvent(new Event(isActive ? 'app-resume' : 'app-suspend'));
      if(isActive) void qc.invalidateQueries({queryKey:['me']});
    }));
    void keep(PushNotifications.addListener('pushNotificationActionPerformed', ({notification}) => {
      const room=String(notification.data?.room ?? '');
      if(/^[1-9][0-9]*$/.test(room)) navigate('/rooms/'+room);
    }));
    return () => {disposed=true;handles.forEach(h=>void h.remove());};
  },[navigate]);
  useEffect(() => {
    if(!userId || !Capacitor.isNativePlatform()) return;
    let disposed=false;
    const handles: PluginListenerHandle[]=[];
    const setup=async() => {
      const reg=await PushNotifications.addListener('registration', ({value}) => {
        if(!disposed) void api('/push/register',{token:value}).catch(() => window.dispatchEvent(new CustomEvent('push-status',{detail:'알림 등록 실패. 내 정보에서 다시 켜주세요.'})));
      });
      if(disposed){await reg.remove();return;} handles.push(reg);
      const err=await PushNotifications.addListener('registrationError', () => window.dispatchEvent(new CustomEvent('push-status',{detail:'알림 등록 실패. Firebase 설정을 확인하세요.'})));
      if(disposed){await err.remove();return;} handles.push(err);
      if((await PushNotifications.checkPermissions()).receive === 'granted' && !disposed) await enablePush();
    };
    void setup().catch(()=>{});
    return () => {disposed=true;handles.forEach(h=>void h.remove());};
  },[userId]);
}
