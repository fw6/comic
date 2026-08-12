plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.tiktok.sparkling.methods.cimoc"
    compileSdk = 34

    defaultConfig {
        minSdk = 21
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    val sparklingVersion =
        (findProperty("SPARKLING_ANDROID_SDK_VERSION") as? String)
            ?: System.getenv("SPARKLING_ANDROID_SDK_VERSION")
            ?: "2.1.0-rc.36"
    if (rootProject.findProject(":sparkling-method") != null) {
        api(project(":sparkling-method"))
    } else {
        api("com.tiktok.sparkling:sparkling-method:$sparklingVersion")
    }
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
