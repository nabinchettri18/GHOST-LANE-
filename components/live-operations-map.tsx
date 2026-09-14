'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, MapPin, Navigation, Radio, Siren, Truck } from 'lucide-react'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Shipment={shipment_id:string;lane_id:string;carrier:string;status:string;live_lat:number|null;live_lng:number|null;current_eta:string|null;vehicle_id:string|null;risk_score:number|null}
type Lane={id:string;origin:string;destination:string}
type Help={shipment_id:string;status:string;latitude:number|null;longitude:number|null}

type RouteData={origin:{lat:number;lng:number;label:string};destination:{lat:number;lng:number;label:string};distanceKm:number;durationMin:number;geometry:{type:'LineString';coordinates:[number,number][]};steps:{instruction:string;distanceM:number}[]}

const riskClass=(risk:number)=>risk>=70?'bg-[#fff0f0] text-[#b54747]':risk>=45?'bg-[#fff8e7] text-[#9b6a00]':'bg-[#eef9f4] text-[#23825b]'

export function LiveOperationsMap({shipments,lanes,help,selectedId,onSelect}:{shipments:Shipment[];lanes:Lane[];help:Help[];selectedId:string;onSelect:(id:string)=>void}){
 const points=useMemo(()=>shipments.filter(s=>s.live_lat!=null&&s.live_lng!=null),[shipments])
 const selected=shipments.find(s=>s.shipment_id===selectedId)
 const lane=selected?lanes.find(l=>l.id===selected.lane_id):undefined
 const mapHostRef=useRef<HTMLDivElement>(null)
 const mapRef=useRef<Leaflet.Map|null>(null)
 const layerRef=useRef<Leaflet.LayerGroup|null>(null)
 const routeRef=useRef<Leaflet.GeoJSON|null>(null)
 const [route,setRoute]=useState<RouteData|null>(null)
 const [routeLoading,setRouteLoading]=useState(false)
 const [routeError,setRouteError]=useState('')

 useEffect(()=>{
   let cancelled=false
   const load=async()=>{
     if(!lane){setRoute(null);return}
     setRouteLoading(true);setRouteError('')
     try{
       const res=await fetch(`/api/maps/route?origin=${encodeURIComponent(lane.origin)}&destination=${encodeURIComponent(lane.destination)}`)
       const data=await res.json()
       if(!res.ok) throw new Error(data.error||'Route unavailable')
       if(!cancelled)setRoute(data)
     }catch(e){if(!cancelled){setRoute(null);setRouteError(e instanceof Error?e.message:'Route unavailable')}}
     finally{if(!cancelled)setRouteLoading(false)}
   }
   void load()
   return()=>{cancelled=true}
 },[lane?.id,lane?.origin,lane?.destination])

 useEffect(()=>{
   if(!mapHostRef.current||mapRef.current)return
   let active=true
   void import('leaflet').then(L=>{
     if(!active||!mapHostRef.current||mapRef.current)return
     const map=L.map(mapHostRef.current,{zoomControl:true,attributionControl:true})
     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map)
     mapRef.current=map
     layerRef.current=L.layerGroup().addTo(map)
     map.setView([20.5937,78.9629],5)
   })
   return()=>{active=false;if(mapRef.current){mapRef.current.remove();mapRef.current=null;layerRef.current=null}}
 },[])

 useEffect(()=>{
   const map=mapRef.current, layer=layerRef.current
   if(!map||!layer)return
   void import('leaflet').then(L=>{
     layer.clearLayers()
     const bounds:L.LatLngBoundsExpression=[]
     points.forEach(p=>{
       const lat=Number(p.live_lat),lng=Number(p.live_lng),risk=Number(p.risk_score||0)
       const marker=L.circleMarker([lat,lng],{radius:p.shipment_id===selectedId?11:8,weight:3,fillOpacity:.9})
       const helpOpen=help.some(h=>h.shipment_id===p.shipment_id&&h.status==='open')
       marker.bindPopup(`<b>${p.vehicle_id||p.shipment_id}</b><br/>Shipment: ${p.shipment_id}<br/>Status: ${p.status}<br/>Risk: ${Math.round(risk)}%${p.current_eta?`<br/>ETA: ${p.current_eta}`:''}${helpOpen?'<br/><b>Driver help: OPEN</b>':''}`)
       marker.on('click',()=>onSelect(p.shipment_id))
       marker.addTo(layer);bounds.push([lat,lng])
     })
     help.filter(h=>h.status==='open'&&h.latitude!=null&&h.longitude!=null).forEach(h=>{
       const marker=L.marker([Number(h.latitude),Number(h.longitude)])
       marker.bindPopup(`<b>Driver help request</b><br/>Shipment: ${h.shipment_id}`)
       marker.addTo(layer);bounds.push([Number(h.latitude),Number(h.longitude)])
     })
     if(bounds.length&&!selected?.live_lat){map.fitBounds(bounds,{padding:[30,30],maxZoom:10})}
     else if(selected?.live_lat!=null&&selected.live_lng!=null){map.setView([Number(selected.live_lat),Number(selected.live_lng)],12)}
     else if(!points.length&&(!help.length||!help.some(h=>h.latitude!=null&&h.longitude!=null))){map.setView([20.5937,78.9629],5)}
   })
 },[points,help,selectedId,selected?.live_lat,selected?.live_lng,onSelect])

 useEffect(()=>{
   const map=mapRef.current
   if(!map)return
   void import('leaflet').then(L=>{
     if(routeRef.current){routeRef.current.remove();routeRef.current=null}
     if(!route?.geometry)return
     routeRef.current=L.geoJSON(route.geometry,{style:{weight:5,opacity:.85}}).addTo(map)
     const bounds=routeRef.current.getBounds()
     if(bounds.isValid()&&!selected?.live_lat)map.fitBounds(bounds,{padding:[30,30],maxZoom:10})
   })
 },[route,selected?.live_lat])

 const directions=lane?`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(lane.origin)}&destination=${encodeURIComponent(lane.destination)}`:''
 const liveCount=points.length

 return <section className="overflow-hidden rounded-3xl border border-[#dbe2ec] bg-white"><div className="flex flex-col gap-3 border-b border-[#edf0f5] p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#1769e0]"><Radio size={13}/> Live map API</div><h2 className="mt-2 text-lg font-black">Fleet position</h2><p className="mt-1 text-[10px] text-[#8994a3]">OpenStreetMap tiles + live shipment coordinates + API-routed lanes. No location is invented.</p></div>{lane&&<a href={directions} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#dbe2ec] px-3 py-2 text-[10px] font-black"><Navigation size={12}/>Directions<ExternalLink size={11}/></a>}</div><div className="relative h-[360px] overflow-hidden bg-[#edf2f7]"><div ref={mapHostRef} className="absolute inset-0 z-0"/>{!liveCount&&!route&&<div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-6 text-center"><div className="rounded-2xl border border-dashed border-[#cfd8e3] bg-white/95 p-7 shadow-sm"><MapPin className="mx-auto text-[#1769e0]" size={25}/><div className="mt-3 text-sm font-black">No live coordinates yet</div><p className="mt-1 max-w-sm text-[10px] leading-5 text-[#8994a3]">Connect your TMS, telematics or driver location feed to populate the fleet map.</p></div></div>}{routeLoading&&<div className="absolute right-3 top-3 z-[600] rounded-xl bg-white/95 px-3 py-2 text-[9px] font-black shadow-sm">Calculating route…</div>}{routeError&&<div className="absolute right-3 top-3 z-[600] max-w-xs rounded-xl bg-white/95 px-3 py-2 text-[9px] font-black text-[#b54747] shadow-sm">{routeError}</div>}{route&&<div className="absolute bottom-4 left-4 z-[600] rounded-2xl border border-[#dbe2ec] bg-white/95 p-3 text-[9px] font-bold shadow-sm"><div className="font-black">API route: {route.distanceKm.toFixed(1)} km · {Math.round(route.durationMin)} min</div><div className="mt-1 text-[#8994a3]">{route.origin.label.split(',').slice(0,2).join(', ')} → {route.destination.label.split(',').slice(0,2).join(', ')}</div></div>}</div><div className="grid gap-2 border-t border-[#edf0f5] p-3 sm:grid-cols-3">{shipments.slice(0,6).map(s=>{const h=help.find(x=>x.shipment_id===s.shipment_id&&x.status==='open');return <button key={s.shipment_id} onClick={()=>onSelect(s.shipment_id)} className={`rounded-xl p-3 text-left ${s.shipment_id===selectedId?'bg-[#edf4ff]':'bg-[#f7f9fc]'}`}><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1 text-[10px] font-black"><Truck size={12}/>{s.vehicle_id||s.shipment_id}</span><span className={`rounded-md px-1.5 py-1 text-[8px] font-black ${riskClass(Number(s.risk_score||0))}`}>{Math.round(Number(s.risk_score||0))}%</span></div>{h&&<div className="mt-2 flex items-center gap-1 text-[9px] font-black text-[#b54747]"><Siren size={10}/>Help open</div>}</button>})}</div></section>
}
