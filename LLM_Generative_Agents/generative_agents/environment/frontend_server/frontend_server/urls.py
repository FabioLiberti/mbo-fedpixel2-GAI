"""frontend_server URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/2.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf.urls import include, url
from django.urls import path
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static

from translator import views as translator_views

urlpatterns = [
    url(r'^$', translator_views.landing, name='landing'),
    url(r'^simulator_home$', translator_views.home, name='home'),
    url(r'^demo/(?P<sim_code>[\w-]+)/(?P<step>[\w-]+)/(?P<play_speed>[\w-]+)/$', translator_views.demo, name='demo'),
    url(r'^replay/(?P<sim_code>[\w-]+)/(?P<step>[\w-]+)/$', translator_views.replay, name='replay'),
    url(r'^replay_persona_state/(?P<sim_code>[\w-]+)/(?P<step>[\w-]+)/(?P<persona_name>[\w-]+)/$', translator_views.replay_persona_state, name='replay_persona_state'),
    url(r'^process_environment/$', translator_views.process_environment, name='process_environment'),
    url(r'^update_environment/$', translator_views.update_environment, name='update_environment'),
    url(r'^path_tester/$', translator_views.path_tester, name='path_tester'),
    url(r'^path_tester_update/$', translator_views.path_tester_update, name='path_tester_update'),
    
    # Nuovi URL per debug e monitoring - usa translator_views.nome_funzione
    url(r'^debug/$', translator_views.debug_frontend, name='debug_frontend'),
    url(r'^check_backend_connection$', translator_views.check_backend_connection, name='check_backend_connection'),
    url(r'^get_curr_sim_code$', translator_views.get_curr_sim_code, name='get_curr_sim_code'),
    url(r'^log_viewer/$', translator_views.log_viewer, name='log_viewer'),
    url(r'^simulator_enhanced/$', translator_views.simulator_enhanced, name='simulator_enhanced'),
    url(r'^simple_debug/$', translator_views.simple_debug, name='simple_debug'),
    url(r'^fixed_simulator/$', translator_views.fixed_simulator, name='fixed_simulator'),
    url(r'^api/status/$', translator_views.api_status, name='api_status'),
    url(r'^api/logs/$', translator_views.api_logs, name='api_logs'),
    
    path('admin/', admin.site.urls),
]