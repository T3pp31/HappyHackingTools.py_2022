/// Npcap ランタイム (wpcap.dll) の存在チェック

#[cfg(target_os = "windows")]
pub fn is_npcap_available() -> bool {
    use std::ffi::CString;

    extern "system" {
        fn LoadLibraryA(name: *const i8) -> *mut std::ffi::c_void;
        fn FreeLibrary(handle: *mut std::ffi::c_void) -> i32;
    }

    let name = CString::new("wpcap.dll").expect("CString::new failed");
    let handle = unsafe { LoadLibraryA(name.as_ptr()) };
    if handle.is_null() {
        false
    } else {
        unsafe {
            FreeLibrary(handle);
        }
        true
    }
}

#[cfg(not(target_os = "windows"))]
pub fn is_npcap_available() -> bool {
    true
}
