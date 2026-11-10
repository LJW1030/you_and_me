import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { api, qc } from './api';

export async function disablePush() {
  await api("/push/unregister",{});
  localStorage.setItem("push-opt-out","true");
  await PushNotifications.removeAllDeliveredNotifications().catch(()=>{});
}
export async function enablePush(manual = true) {
  if(Capacitor.getPlatform() !== 'android') throw new Error('알림은 안드로이드 앱에서 설정할 수 있습니다.');
  if(!manual && localStorage.getItem('push-opt-out') === 'true') return;
  const status = await api('/push/status');
  if(!status.enabled) throw new Error('서버의 Firebase 설정이 아직 완료되지 않았습니다.');
  let permission = await PushNotifications.checkPermissions();
  if(permission.receive !== 'granted' && !manual) return;
  if(permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') permission = await PushNotifications.requestPermissions();
  if(permission.receive !== 'granted') throw new Error('휴대폰 앱 설정에서 알림 권한을 허용해주세요.');
  await PushNotifications.createChannel({id:'messages',name:'새 메시지',importance:4,visibility:0});
  if(manual) localStorage.removeItem('push-opt-out');
  await PushNotifications.register();
}
export function useMobile(userId: number | undefined) {
  const navigate=useNavigate();
  useEffect(() => {
    if(!Capacitor.isNativePlatform()) return;
    let disposed=false;
    const handles: PluginListenerHandle[]=[];
    const keep=async(p:Promise<PluginListenerHandle>) => {const h=await p; if(disposed) await h.remove(); else handles.push(h);};
    if(Capacitor.getPlatform() === 'android') void keep(App.addListener('backButton', () => {
      if(location.pathname !== '/') navigate('/'); else void App.minimizeApp();
    }));
    void keep(App.addListener('appStateChange', ({isActive}) => {
      window.dispatchEvent(new Event(isActive ? 'app-resume' : 'app-suspend'));
      if(isActive) void qc.invalidateQueries({queryKey:['me']});
    }));
    if(Capacitor.getPlatform() === 'android') void keep(PushNotifications.addListener('pushNotificationActionPerformed', ({notification}) => {
      const room=String(notification.data?.room ?? '');
      if(/^[1-9][0-9]*$/.test(room)) navigate('/rooms/'+room);
    }));
    return () => {disposed=true;handles.forEach(h=>void h.remove());};
  },[navigate]);
  useEffect(() => {
    if(!userId || Capacitor.getPlatform() !== 'android') return;
    let disposed=false;
    const handles: PluginListenerHandle[]=[];
    const setup=async() => {
      const reg=await PushNotifications.addListener('registration', ({value}) => {
        if(!disposed && localStorage.getItem('push-opt-out') !== 'true') void api('/push/register',{token:value}).then(()=>window.dispatchEvent(new CustomEvent('push-status',{detail:'이 기기의 알림 등록이 완료됐습니다. 백그라운드 수신을 테스트하세요.'}))).catch(() => window.dispatchEvent(new CustomEvent('push-status',{detail:'알림 등록 실패. 내 정보에서 다시 켜주세요.'})));
      });
      if(disposed){await reg.remove();return;} handles.push(reg);
      const err=await PushNotifications.addListener('registrationError', () => window.dispatchEvent(new CustomEvent('push-status',{detail:'알림 등록 실패. Firebase 설정을 확인하세요.'})));
      if(disposed){await err.remove();return;} handles.push(err);
      if((await PushNotifications.checkPermissions()).receive === 'granted' && !disposed) await enablePush(false);
    };
    const retry=()=>{if(!disposed) void enablePush(false).catch(()=>{});};
    window.addEventListener('online',retry);
    window.addEventListener('app-resume',retry);
    void setup().catch(()=>{});
    return () => {disposed=true;window.removeEventListener('online',retry);window.removeEventListener('app-resume',retry);handles.forEach(h=>void h.remove());};
  },[userId]);
}
