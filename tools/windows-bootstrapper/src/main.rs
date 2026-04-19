use happyhackingtools_bootstrapper::{
    build_http_client, build_release_page_url, download_installer, fetch_release_metadata,
    find_installed_app, launch_installed_app, launch_installer, load_config, open_release_page,
    prompt_yes_no, resolve_installer_target, wait_for_enter, BootstrapperError,
};

fn main() {
    let exit_code = match run() {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("[ERROR] {error}");
            1
        }
    };

    std::process::exit(exit_code);
}

fn run() -> Result<(), BootstrapperError> {
    let config = load_config()?;
    println!("{}", config.message.welcome);
    println!("{}", config.message.fetch_release);

    let client = build_http_client(&config)?;
    let fallback_release_page = build_release_page_url(&config);

    let release = match fetch_release_metadata(&client, &config) {
        Ok(release) => release,
        Err(error) => {
            handle_release_failure(
                &config.message.open_release_prompt,
                &fallback_release_page,
                &error,
            );
            return Err(error);
        }
    };

    let release_page = if release.html_url.is_empty() {
        fallback_release_page.clone()
    } else {
        release.html_url.clone()
    };

    let target = match resolve_installer_target(&release, &config) {
        Ok(target) => target,
        Err(error) => {
            handle_release_failure(&config.message.open_release_prompt, &release_page, &error);
            return Err(error);
        }
    };

    println!("{}", config.message.download_start);
    if let Err(error) = download_installer(&client, &target) {
        handle_release_failure(&config.message.open_release_prompt, &release_page, &error);
        return Err(error);
    }

    println!("{}", config.message.download_complete);
    let installer_status = launch_installer(&target.download_path)?;
    if happyhackingtools_bootstrapper::installer_was_cancelled(&installer_status) {
        println!("{}", config.message.installer_cancelled);
        wait_for_enter(&config.message.exit_prompt);
        return Ok(());
    }

    println!("{}", config.message.installer_complete);
    if let Some(path) = find_installed_app(&config) {
        if prompt_yes_no(&config.message.launch_prompt, true) {
            launch_installed_app(&path)?;
        }
    }

    wait_for_enter(&config.message.exit_prompt);
    Ok(())
}

fn handle_release_failure(prompt: &str, release_page: &str, error: &BootstrapperError) {
    eprintln!("[ERROR] {error}");
    if prompt_yes_no(prompt, true) {
        if let Err(open_error) = open_release_page(release_page) {
            eprintln!("[ERROR] {open_error}");
        }
    }
}
