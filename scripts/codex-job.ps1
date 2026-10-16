param([Parameter(Mandatory=$true)][string]$Executable,[Parameter(Mandatory=$true)][string]$Receipt)
$ErrorActionPreference = 'Stop'
# Suspended creation prevents descendants escaping before job assignment.
# Closing this job also kills descendants if the supervisor is interrupted.
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class BenchmarkJob {
 [StructLayout(LayoutKind.Sequential)] struct STARTUPINFO { public int cb; public IntPtr reserved, desktop, title; public int x,y,xs,ys,xc,yc,fill,flags; public short show,reserved2; public IntPtr reserved3,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr process,thread; public uint pid,tid; }
 [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMIT { public long processTime,jobTime; public uint flags; public UIntPtr min,max; public uint active; public UIntPtr affinity; public uint priority,scheduling; }
 [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS { public ulong ro,wo,oo,rt,wt,ot; }
 [StructLayout(LayoutKind.Sequential)] struct EXTENDED_LIMIT { public BASIC_LIMIT basic; public IO_COUNTERS io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob; }
 [StructLayout(LayoutKind.Sequential)] struct ACCOUNTING { public long user,kernel,periodUser,periodKernel; public uint faults,total,active,terminated; }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr a,string n);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr h,int c,ref EXTENDED_LIMIT v,int l);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr h,int c,out ACCOUNTING v,int l,IntPtr r);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref STARTUPINFO si,out PROCESS_INFORMATION pi);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr j,IntPtr p);
 [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr t);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h,uint ms);
 [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr p,out uint c);
 [DllImport("kernel32.dll")] static extern bool TerminateJobObject(IntPtr j,uint c);
 [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr p,uint c);
 [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int n);
 [DllImport("kernel32.dll")] static extern bool SetHandleInformation(IntPtr h,uint mask,uint flags);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 public static int Run(string exe,string receipt) {
  IntPtr job=CreateJobObject(IntPtr.Zero,null); PROCESS_INFORMATION pi=new PROCESS_INFORMATION();
  if(job==IntPtr.Zero)throw new Exception("CODEX_JOB_CREATE");
  try {
   EXTENDED_LIMIT limit=new EXTENDED_LIMIT();limit.basic.flags=0x2000;
   if(!SetInformationJobObject(job,9,ref limit,Marshal.SizeOf(limit)))throw new Exception("CODEX_JOB_LIMIT");
   STARTUPINFO si=new STARTUPINFO();si.cb=Marshal.SizeOf(si);si.flags=0x100;
   si.input=GetStdHandle(-10);si.output=GetStdHandle(-11);si.error=GetStdHandle(-12);
   foreach(IntPtr h in new[]{si.input,si.output,si.error})if(!SetHandleInformation(h,1,1))throw new Exception("CODEX_JOB_STDIO");
   var cmd=new StringBuilder("\""+exe+"\" exec --json --ephemeral --ignore-rules --strict-config --color never -");
   if(!CreateProcess(exe,cmd,IntPtr.Zero,IntPtr.Zero,true,0x08000004,IntPtr.Zero,null,ref si,out pi))throw new Exception("CODEX_JOB_START");
   if(!AssignProcessToJobObject(job,pi.process)){TerminateProcess(pi.process,1);throw new Exception("CODEX_JOB_ASSIGN");}
   if(ResumeThread(pi.thread)==0xffffffff)throw new Exception("CODEX_JOB_RESUME");
   WaitForSingleObject(pi.process,0xffffffff);uint code;
   if(!GetExitCodeProcess(pi.process,out code)||!TerminateJobObject(job,1))throw new Exception("CODEX_JOB_TERMINATE");
   for(int i=0;i<100;i++){
    ACCOUNTING a;if(!QueryInformationJobObject(job,1,out a,Marshal.SizeOf(typeof(ACCOUNTING)),IntPtr.Zero))throw new Exception("CODEX_JOB_QUERY");
    if(a.active==0){System.IO.File.WriteAllText(receipt,"{\"cleanupConfirmed\":true,\"exitCode\":"+code+"}");return (int)code;}
    System.Threading.Thread.Sleep(50);
   }
   throw new Exception("CODEX_JOB_CLEANUP_UNCONFIRMED");
  }finally{CloseHandle(job);if(pi.thread!=IntPtr.Zero)CloseHandle(pi.thread);if(pi.process!=IntPtr.Zero)CloseHandle(pi.process);}
 }
}
'@
exit [BenchmarkJob]::Run($Executable,$Receipt)
